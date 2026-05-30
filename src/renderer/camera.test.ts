import { describe, expect, it } from 'vitest';
import { PITCH_COUNT, PITCH_DEFAULT } from '../core/render';
import { createCamera } from './camera';

describe('createCamera', () => {
  it('starts at default yaw, pitch, and centres pan on the canvas', () => {
    const cam = createCamera();
    const c = cam.forCanvas(800, 600);
    expect(c.yaw).toBe(0);
    expect(c.pitch).toBe(PITCH_DEFAULT);
    expect(c.panX).toBe(400);
    expect(c.panY).toBe(300);
  });

  it('wraps yaw through the four steps in both directions', () => {
    const cam = createCamera();
    cam.rotateBy(-1);
    expect(cam.forCanvas(0, 0).yaw).toBe(3);
    cam.rotateBy(1);
    expect(cam.forCanvas(0, 0).yaw).toBe(0);
    for (let i = 0; i < 4; i++) cam.rotateBy(1);
    expect(cam.forCanvas(0, 0).yaw).toBe(0);
  });

  it('wraps pitch modulo PITCH_COUNT in both directions', () => {
    const cam = createCamera();
    cam.pitchBy(-1);
    expect(cam.forCanvas(0, 0).pitch).toBe((PITCH_DEFAULT - 1 + PITCH_COUNT) % PITCH_COUNT);
    for (let i = 0; i < PITCH_COUNT; i++) cam.pitchBy(1);
    expect(cam.forCanvas(0, 0).pitch).toBe((PITCH_DEFAULT - 1 + PITCH_COUNT) % PITCH_COUNT);
  });

  it('clamps zoom out at the minimum', () => {
    const cam = createCamera();
    for (let i = 0; i < 100; i++) cam.zoomOut();
    expect(cam.forCanvas(0, 0).zoom).toBeGreaterThanOrEqual(4);
  });

  it('clamps zoom in at the maximum', () => {
    const cam = createCamera();
    for (let i = 0; i < 100; i++) cam.zoomIn();
    expect(cam.forCanvas(0, 0).zoom).toBeLessThanOrEqual(96);
  });

  it('accumulates pan offsets on top of the canvas centre', () => {
    const cam = createCamera();
    cam.panBy(10, -5);
    cam.panBy(2, 3);
    const c = cam.forCanvas(100, 100);
    expect(c.panX).toBe(50 + 12);
    expect(c.panY).toBe(50 - 2);
  });
});
