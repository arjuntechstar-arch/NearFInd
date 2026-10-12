import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canTransitionBooking } from './booking.service.js';
import { BookingStatus, DispatchStatus } from './entities.js';
import { canTransitionDispatch } from './roadside.service.js';

void describe('platform state machines', () => {
  void it('allows only expected booking transitions', () => {
    assert.equal(canTransitionBooking(BookingStatus.RESERVED, BookingStatus.CONFIRMED), true);
    assert.equal(canTransitionBooking(BookingStatus.RESERVED, BookingStatus.COMPLETED), false);
    assert.equal(canTransitionBooking(BookingStatus.CONFIRMED, BookingStatus.COMPLETED), true);
    assert.equal(canTransitionBooking(BookingStatus.CANCELLED, BookingStatus.CONFIRMED), false);
  });

  void it('allows only ordered roadside transitions', () => {
    assert.equal(canTransitionDispatch(DispatchStatus.REQUESTED, DispatchStatus.TRIAGED), true);
    assert.equal(canTransitionDispatch(DispatchStatus.TRIAGED, DispatchStatus.ASSIGNED), true);
    assert.equal(canTransitionDispatch(DispatchStatus.ASSIGNED, DispatchStatus.ARRIVED), false);
    assert.equal(canTransitionDispatch(DispatchStatus.ARRIVED, DispatchStatus.COMPLETED), true);
    assert.equal(canTransitionDispatch(DispatchStatus.COMPLETED, DispatchStatus.CANCELLED), false);
  });
});
