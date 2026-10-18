import { test } from 'node:test';
import assert from 'node:assert/strict';
import { subscribeTeamPlanner, broadcastTeamPlannerUpdate } from './team-planner-realtime';

function fakeSocket(fail = false) {
  const messages: string[] = [];
  const events = new EventTarget();
  const socket = {
    readyState: 1,
    addEventListener: events.addEventListener.bind(events),
    send(message: string) {
      if (fail) throw new Error('Connection lost');
      messages.push(message);
    },
  };
  return { socket: socket as unknown as WebSocket, messages, close: () => events.dispatchEvent(new Event('close')) };
}

test('updates only reach the correct club and closed subscriptions are removed', () => {
  const first = fakeSocket();
  const other = fakeSocket();
  subscribeTeamPlanner('realtime-a', first.socket);
  subscribeTeamPlanner('realtime-b', other.socket);
  broadcastTeamPlannerUpdate('realtime-a');
  assert.deepEqual(first.messages.map((message) => JSON.parse(message)), [{ type: 'planner-updated', clubId: 'realtime-a' }]);
  assert.equal(other.messages.length, 0);
  first.close();
  broadcastTeamPlannerUpdate('realtime-a');
  assert.equal(first.messages.length, 1);
  other.close();
});

test('a broken connection does not fail a save or block other recipients', () => {
  const broken = fakeSocket(true);
  const healthy = fakeSocket();
  subscribeTeamPlanner('realtime-failure', broken.socket);
  subscribeTeamPlanner('realtime-failure', healthy.socket);
  assert.doesNotThrow(() => broadcastTeamPlannerUpdate('realtime-failure'));
  assert.equal(healthy.messages.length, 1);
  healthy.close();
  broken.close();
});
