class NoopCaptureSignal {
  add(): void {
    // Phaser only uses this in debug builds; the stub keeps bundlers happy.
  }
}

class NoopResultUi {
  display(): void {
    // no-op
  }
}

export class Spector {
  readonly onCapture = new NoopCaptureSignal();

  captureCanvas(): void {
    // no-op
  }

  captureNextFrame(): void {
    // no-op
  }

  getFps(): number {
    return 0;
  }

  getResultUI(): NoopResultUi {
    return new NoopResultUi();
  }

  log(text: string): string {
    return text;
  }

  startCapture(): void {
    // no-op
  }

  stopCapture(): null {
    return null;
  }
}
