"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PixelDiffEngine = void 0;
const pngjs_1 = require("pngjs");
const pixelmatch_1 = __importDefault(require("pixelmatch"));
const DEFAULT_CONFIG = {
    threshold: 0.1,
    includeAA: false,
    minRegionSize: 10,
    diffColor: [255, 0, 255, 255],
    alpha: 0.3,
    aaDetection: true,
};
/**
 * Pixel Diff Engine for screenshot comparison.
 */
class PixelDiffEngine {
    config;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Compare two screenshots for differences.
     */
    async compare(before, after, options) {
        const detailed = await this.compareDetailed(before, after, options);
        return {
            changed: detailed.changed,
            changePercentage: detailed.changePercentage,
            changedRegions: detailed.changedRegions,
            before,
            after,
            diff: detailed.diff,
        };
    }
    /**
     * Compare with detailed analysis.
     */
    async compareDetailed(before, after, options) {
        // Parse PNGs
        const img1 = pngjs_1.PNG.sync.read(before);
        const img2 = pngjs_1.PNG.sync.read(after);
        // Ensure same dimensions
        if (img1.width !== img2.width || img1.height !== img2.height) {
            throw new Error(`Image dimensions don't match: ${img1.width}x${img1.height} vs ${img2.width}x${img2.height}`);
        }
        const { width, height } = img1;
        const totalPixels = width * height;
        // Apply ignore regions mask
        if (options?.ignoreRegions?.length) {
            this.applyIgnoreMask(img1, img2, options.ignoreRegions);
        }
        // Create diff output
        const diff = new pngjs_1.PNG({ width, height });
        // Run pixelmatch
        const threshold = options?.threshold ?? this.config.threshold;
        const [r, g, b] = this.config.diffColor;
        const diffPixels = (0, pixelmatch_1.default)(img1.data, img2.data, diff.data, width, height, {
            threshold,
            includeAA: this.config.includeAA,
            alpha: this.config.alpha,
            diffColor: [r, g, b],
            aaColor: [255, 255, 0], // Yellow for AA pixels
        });
        // Calculate change percentage
        const changePercentage = (diffPixels / totalPixels) * 100;
        // Find change regions
        const changedRegions = this.findChangeRegions(diff, width, height);
        return {
            changed: diffPixels > 0,
            changePercentage,
            diffPixels,
            totalPixels,
            changedRegions,
            before,
            after,
            diff: pngjs_1.PNG.sync.write(diff),
            dimensions: { width, height },
        };
    }
    /**
     * Apply ignore mask to images.
     */
    applyIgnoreMask(img1, img2, regions) {
        for (const region of regions) {
            for (let y = region.y; y < region.y + region.height; y++) {
                for (let x = region.x; x < region.x + region.width; x++) {
                    if (x < img1.width && y < img1.height) {
                        const idx = (img1.width * y + x) << 2;
                        // Set both images to same color in masked region
                        img1.data[idx] = img2.data[idx] = 128;
                        img1.data[idx + 1] = img2.data[idx + 1] = 128;
                        img1.data[idx + 2] = img2.data[idx + 2] = 128;
                        img1.data[idx + 3] = img2.data[idx + 3] = 255;
                    }
                }
            }
        }
    }
    /**
     * Find contiguous regions of change.
     */
    findChangeRegions(diff, width, height) {
        const visited = new Set();
        const regions = [];
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (width * y + x) << 2;
                // Check if this pixel is different (not black)
                if (diff.data[idx] !== 0 || diff.data[idx + 1] !== 0 || diff.data[idx + 2] !== 0) {
                    const pixelKey = y * width + x;
                    if (!visited.has(pixelKey)) {
                        const region = this.floodFillRegion(diff, x, y, width, height, visited);
                        if (region.pixelCount >= this.config.minRegionSize) {
                            regions.push(region);
                        }
                    }
                }
            }
        }
        // Sort by pixel count (largest first)
        return regions.sort((a, b) => b.pixelCount - a.pixelCount);
    }
    /**
     * Flood fill to find contiguous change region.
     */
    floodFillRegion(diff, startX, startY, width, height, visited) {
        const queue = [[startX, startY]];
        let minX = startX;
        let maxX = startX;
        let minY = startY;
        let maxY = startY;
        let pixelCount = 0;
        while (queue.length > 0) {
            const [x, y] = queue.shift();
            const pixelKey = y * width + x;
            if (visited.has(pixelKey))
                continue;
            if (x < 0 || x >= width || y < 0 || y >= height)
                continue;
            const idx = (width * y + x) << 2;
            // Check if pixel is different
            if (diff.data[idx] === 0 && diff.data[idx + 1] === 0 && diff.data[idx + 2] === 0) {
                continue;
            }
            visited.add(pixelKey);
            pixelCount++;
            // Update bounds
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
            // Add neighbors (4-connected)
            queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
        const regionWidth = maxX - minX + 1;
        const regionHeight = maxY - minY + 1;
        const regionArea = regionWidth * regionHeight;
        return {
            x: minX,
            y: minY,
            width: regionWidth,
            height: regionHeight,
            pixelCount,
            changeIntensity: (pixelCount / regionArea) * 100,
        };
    }
    /**
     * Check if change exceeds threshold.
     */
    hasSignificantChange(diff, threshold = 5) {
        return diff.changePercentage > threshold;
    }
    /**
     * Get largest change region.
     */
    getLargestChangeRegion(diff) {
        if (diff.changedRegions.length === 0)
            return null;
        const region = diff.changedRegions[0];
        return region ?? null;
    }
    /**
     * Create masked diff (highlights changes on original).
     */
    async createHighlightedDiff(original, diff) {
        if (!diff.diff) {
            throw new Error('Diff buffer not available');
        }
        const img = pngjs_1.PNG.sync.read(original);
        const diffImg = pngjs_1.PNG.sync.read(diff.diff);
        // Overlay diff colors on original with transparency
        for (let y = 0; y < img.height; y++) {
            for (let x = 0; x < img.width; x++) {
                const idx = (img.width * y + x) << 2;
                // If diff pixel is not black, blend it
                const diffData = diffImg.data;
                if (diffData[idx] !== 0 ||
                    diffData[idx + 1] !== 0 ||
                    diffData[idx + 2] !== 0) {
                    // Blend original with diff color
                    const imgData = img.data;
                    const currentR = imgData[idx] ?? 0;
                    const currentG = imgData[idx + 1] ?? 0;
                    const currentB = imgData[idx + 2] ?? 0;
                    imgData[idx] = Math.min(255, currentR + 100); // Red
                    imgData[idx + 1] = Math.max(0, currentG - 50); // Green
                    imgData[idx + 2] = Math.max(0, currentB - 50); // Blue
                }
            }
        }
        return pngjs_1.PNG.sync.write(img);
    }
    /**
     * Calculate similarity score between two images.
     */
    async calculateSimilarity(before, after) {
        const diff = await this.compare(before, after);
        return Math.max(0, 100 - diff.changePercentage);
    }
}
exports.PixelDiffEngine = PixelDiffEngine;
//# sourceMappingURL=pixel-diff.js.map