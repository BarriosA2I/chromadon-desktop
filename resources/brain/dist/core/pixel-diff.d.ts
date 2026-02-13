/**
 * Pixel Diff Engine
 *
 * Neural RAG Brain Pattern: Self-RAG [SUP] Token
 *
 * Screenshot comparison for visual verification:
 * - Pixel-level difference detection
 * - Change region identification
 * - Threshold-based filtering
 * - Anti-aliasing handling
 */
/// <reference types="node" />
/// <reference types="node" />
import type { BoundingBox, VisualDiff } from '../interfaces';
/**
 * Configuration for pixel diff operations.
 */
export interface PixelDiffConfig {
    /** Threshold for pixel difference (0-1). Default: 0.1 */
    threshold: number;
    /** Include anti-aliasing pixels. Default: false */
    includeAA: boolean;
    /** Minimum region size to report. Default: 10 */
    minRegionSize: number;
    /** Color for diff highlighting (RGBA). Default: [255, 0, 255, 255] */
    diffColor: [number, number, number, number];
    /** Alpha channel handling. Default: 0.3 */
    alpha: number;
    /** Anti-aliasing detection. Default: true */
    aaDetection: boolean;
}
/**
 * Region of change detected in diff.
 */
export interface ChangeRegion extends BoundingBox {
    /** Number of changed pixels in region */
    pixelCount: number;
    /** Percentage of region that changed */
    changeIntensity: number;
}
/**
 * Detailed diff result.
 */
export interface DetailedDiff {
    /** Whether any changes were detected */
    changed: boolean;
    /** Percentage of total pixels that changed */
    changePercentage: number;
    /** Number of different pixels */
    diffPixels: number;
    /** Total pixels compared */
    totalPixels: number;
    /** Regions where changes occurred */
    changedRegions: ChangeRegion[];
    /** Before screenshot */
    before: Buffer;
    /** After screenshot */
    after: Buffer;
    /** Diff visualization */
    diff: Buffer;
    /** Dimensions */
    dimensions: {
        width: number;
        height: number;
    };
}
/**
 * Pixel Diff Engine for screenshot comparison.
 */
export declare class PixelDiffEngine {
    private config;
    constructor(config?: Partial<PixelDiffConfig>);
    /**
     * Compare two screenshots for differences.
     */
    compare(before: Buffer, after: Buffer, options?: {
        threshold?: number;
        ignoreRegions?: BoundingBox[];
    }): Promise<VisualDiff>;
    /**
     * Compare with detailed analysis.
     */
    compareDetailed(before: Buffer, after: Buffer, options?: {
        threshold?: number;
        ignoreRegions?: BoundingBox[];
    }): Promise<DetailedDiff>;
    /**
     * Apply ignore mask to images.
     */
    private applyIgnoreMask;
    /**
     * Find contiguous regions of change.
     */
    private findChangeRegions;
    /**
     * Flood fill to find contiguous change region.
     */
    private floodFillRegion;
    /**
     * Check if change exceeds threshold.
     */
    hasSignificantChange(diff: VisualDiff, threshold?: number): boolean;
    /**
     * Get largest change region.
     */
    getLargestChangeRegion(diff: VisualDiff): BoundingBox | null;
    /**
     * Create masked diff (highlights changes on original).
     */
    createHighlightedDiff(original: Buffer, diff: VisualDiff): Promise<Buffer>;
    /**
     * Calculate similarity score between two images.
     */
    calculateSimilarity(before: Buffer, after: Buffer): Promise<number>;
}
//# sourceMappingURL=pixel-diff.d.ts.map