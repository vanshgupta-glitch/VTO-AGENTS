// Landmark debug engine for VTO
export class LandmarkDebugEngine {
  private blockingSinceMs: number = 0;
  private clearSinceMs: number = 0;
  private removalBlocked: boolean = false;

  // Constants
  private static BLOCK_HOLD_MS = 2000;
  private static BLOCK_CLEAR_TOLERANCE_MS = 700;

  /**
   * Updates the blocking verdict based on current frame data
   */
  public updateBlockingVerdict(frame: any): void {
    const now = Date.now();
    
    // Check if the current frame indicates a blocking situation
    const isBlocking = this.isBlockingFrame(frame);
    
    if (isBlocking) {
      // If currently blocking, reset the clear timer
      this.clearSinceMs = 0;
      
      // If we weren't previously blocking, start the blocking timer
      if (this.blockingSinceMs === 0) {
        this.blockingSinceMs = now;
      }
    } else {
      // If currently not blocking, we should only reset the blocking timer if we have a sustained clear period
      // This prevents flickering from resetting the block accumulation
      
      // Start or update the clear timer
      if (this.clearSinceMs === 0) {
        this.clearSinceMs = now;
      }
      
      // Only reset blocking timer if we've had a sustained clear period (BLOCK_CLEAR_TOLERANCE_MS) 
      // AND we're not already in a confirmed blocked state
      if (this.clearSinceMs > 0 && now - this.clearSinceMs >= LandmarkDebugEngine.BLOCK_CLEAR_TOLERANCE_MS && !this.removalBlocked) {
        this.blockingSinceMs = 0;
        this.clearSinceMs = 0;
      }
    }

    // Determine if we should latch the removal block
    if (this.blockingSinceMs > 0 && now - this.blockingSinceMs >= LandmarkDebugEngine.BLOCK_HOLD_MS) {
      this.removalBlocked = true;
    }
  }

  /**
   * Determines if the current frame represents a blocking situation
   */
  private isBlockingFrame(frame: any): boolean {
    // Placeholder logic - in reality this would check frame data for blocking indicators
    // For example: sunglasses detection, opaque glasses, etc.
    return frame.glassesType === 'sunglasses' || frame.glassesType === 'opaque';
  }

  /**
   * Gets the current blocking verdict
   */
  public getBlockingVerdict(): { removalBlocked: boolean; verdict: string } {
    const now = Date.now();
    
    // If we've had a sustained clear period and we're not blocked, reset the block state
    if (this.clearSinceMs > 0 && now - this.clearSinceMs >= LandmarkDebugEngine.BLOCK_CLEAR_TOLERANCE_MS && !this.removalBlocked) {
      this.blockingSinceMs = 0;
      this.clearSinceMs = 0;
      this.removalBlocked = false;
    }
    
    // Return the verdict - if removalBlocked is true, emit BLOCKED as first token
    if (this.removalBlocked) {
      return { removalBlocked: true, verdict: 'BLOCKED' };
    }
    
    // If we're in a blocking state but haven't confirmed the block yet
    if (this.blockingSinceMs > 0 && now - this.blockingSinceMs < LandmarkDebugEngine.BLOCK_HOLD_MS) {
      return { removalBlocked: false, verdict: 'CLEAR' };
    }
    
    // Default case
    return { removalBlocked: false, verdict: 'CLEAR' };
  }
}