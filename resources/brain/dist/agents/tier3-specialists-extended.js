"use strict";
// @ts-nocheck
/**
 * CHROMADON Tier 3: Extended Specialist Layer
 * ============================================
 * THE ECOMMERCE EXPERT - Shopping & Checkout Automation
 * THE DATA EXTRACTOR - Web Scraping & Structured Data
 * THE RESEARCH AGENT - Multi-Source Intelligence Gathering
 * THE BOOKING AGENT - Reservations & Appointments
 * THE PAYMENT HANDLER - Payment Form Automation
 *
 * Production-grade with circuit breakers, observability, and resilience
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentHandler = exports.bookingAgent = exports.researchAgent = exports.dataExtractor = exports.ecommerceExpert = exports.createExtendedSpecialists = exports.ThePaymentHandler = exports.TheBookingAgent = exports.TheResearchAgent = exports.TheDataExtractor = exports.TheEcommerceExpert = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const tier0_orchestration_1 = require("./tier0-orchestration");
const event_bus_1 = require("./event-bus");
class TheEcommerceExpert extends tier0_orchestration_1.BaseAgent {
    client;
    platformSelectors;
    cartCache;
    circuitBreaker;
    constructor() {
        super('THE_ECOMMERCE_EXPERT', { model: 'sonnet' });
        this.client = new sdk_1.default();
        this.platformSelectors = this.initPlatformSelectors();
        this.cartCache = new Map();
        this.circuitBreaker = new event_bus_1.CircuitBreaker({
            name: 'ecommerce_expert',
            threshold: 3,
            resetTimeout: 60000,
        });
    }
    initPlatformSelectors() {
        const selectors = new Map();
        selectors.set('amazon', {
            addToCart: ['#add-to-cart-button', '[data-testid="add-to-cart"]', 'input[name="submit.add-to-cart"]'],
            cart: ['#nav-cart', '#nav-cart-count', '.nav-cart-icon'],
            checkout: ['#sc-buy-box-ptc-button', '[data-feature-id="proceed-to-checkout"]'],
            quantity: ['select#quantity', '.a-dropdown-prompt'],
            variant: ['.a-button-text', '.a-declarative'],
            price: ['.a-price-whole', '#priceblock_ourprice', '.a-offscreen'],
            removeItem: ['[data-action="delete"]', 'input[value="Delete"]'],
            promoCode: ['#spc-gcpromoinput', 'input[name="claimCode"]'],
            applyPromo: ['#gcApplyButtonId', 'input[value="Apply"]'],
        });
        selectors.set('shopify', {
            addToCart: ['button[type="submit"][name="add"]', '.product-form__submit', '.add-to-cart'],
            cart: ['.cart-icon', '.cart-link', '[data-cart-toggle]'],
            checkout: ['.checkout-button', '[name="checkout"]', '#checkout'],
            quantity: ['input[name="quantity"]', '.quantity-selector input'],
            variant: ['[data-option-index]', '.variant-input'],
            price: ['.price', '.product-price', '[data-product-price]'],
            removeItem: ['.cart-item__remove', '[data-cart-remove]'],
            promoCode: ['input[name="discount"]', '#discount-code'],
            applyPromo: ['button[name="apply_discount"]', '.discount-button'],
        });
        selectors.set('woocommerce', {
            addToCart: ['.single_add_to_cart_button', '.add_to_cart_button', '[name="add-to-cart"]'],
            cart: ['.cart-contents', '.cart-icon', '.woocommerce-cart-form'],
            checkout: ['.checkout-button', '.wc-proceed-to-checkout a'],
            quantity: ['input.qty', '.quantity input'],
            variant: ['.variations select', '.variation-selector'],
            price: ['.price .amount', '.woocommerce-Price-amount'],
            removeItem: ['.remove', '.product-remove a'],
            promoCode: ['#coupon_code', 'input[name="coupon_code"]'],
            applyPromo: ['[name="apply_coupon"]', '.coupon button'],
        });
        selectors.set('generic', {
            addToCart: ['[class*="add-to-cart"]', '[class*="addtocart"]', 'button:contains("Add to Cart")', '[data-action="add-to-cart"]'],
            cart: ['[class*="cart"]', '[class*="basket"]', '[aria-label*="cart"]'],
            checkout: ['[class*="checkout"]', 'button:contains("Checkout")', 'a:contains("Proceed")'],
            quantity: ['input[type="number"]', 'select[name*="quantity"]', '[class*="quantity"] input'],
            variant: ['select[name*="variant"]', '[class*="option"]', '[class*="swatch"]'],
            price: ['[class*="price"]', '[itemprop="price"]', '[data-price]'],
            removeItem: ['[class*="remove"]', '[class*="delete"]', 'button:contains("Remove")'],
            promoCode: ['input[name*="promo"]', 'input[name*="coupon"]', 'input[name*="discount"]'],
            applyPromo: ['button:contains("Apply")', '[class*="apply"]'],
        });
        return selectors;
    }
    async addToCart(cdpController, product) {
        if (!await this.circuitBreaker.canExecute()) {
            return { success: false, error: 'Circuit breaker open - too many failures' };
        }
        try {
            const eventBus = (0, event_bus_1.getEventBus)();
            eventBus.publish({
                type: 'agent.action_started',
                agentName: this.name,
                action: 'add_to_cart',
                timestamp: Date.now(),
            });
            // Navigate to product if URL provided
            if (product.url) {
                await cdpController.send('Page.navigate', { url: product.url });
                await this.waitForPageLoad(cdpController);
            }
            // Detect platform
            const platform = await this.detectPlatform(cdpController);
            const selectors = this.platformSelectors.get(platform) || this.platformSelectors.get('generic');
            // Select variants if provided
            if (product.variants) {
                for (const [variantType, value] of Object.entries(product.variants)) {
                    await this.selectVariant(cdpController, variantType, value, selectors);
                    await this.delay(300);
                }
            }
            // Set quantity if not default
            if (product.quantity && product.quantity > 1) {
                await this.setQuantity(cdpController, product.quantity, selectors);
                await this.delay(200);
            }
            // Click add to cart
            const addToCartClicked = await this.clickFirstMatch(cdpController, selectors.addToCart);
            if (!addToCartClicked) {
                throw new Error('Could not find add to cart button');
            }
            // Wait for cart update
            await this.delay(1500);
            await this.waitForCartUpdate(cdpController);
            // Get current cart state
            const cartState = await this.getCartState(cdpController, selectors);
            this.circuitBreaker.recordSuccess();
            eventBus.publish({
                type: 'agent.action_completed',
                agentName: this.name,
                action: 'add_to_cart',
                success: true,
                timestamp: Date.now(),
            });
            return { success: true, cartState };
        }
        catch (error) {
            this.circuitBreaker.recordFailure();
            return { success: false, error: error.message };
        }
    }
    async getCartState(cdpController, selectors) {
        if (!selectors) {
            const platform = await this.detectPlatform(cdpController);
            selectors = this.platformSelectors.get(platform) || this.platformSelectors.get('generic');
        }
        // Use Claude to analyze cart page
        const screenshot = await cdpController.send('Page.captureScreenshot', { format: 'png' });
        const htmlResult = await cdpController.send('Runtime.evaluate', {
            expression: 'document.body.innerHTML',
            returnByValue: true,
        });
        const response = await this.client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2000,
            messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: { type: 'base64', media_type: 'image/png', data: screenshot.data },
                        },
                        {
                            type: 'text',
                            text: `Analyze this shopping cart page and extract the cart state.
            
Return a JSON object with this structure:
{
  "items": [{"id": "...", "name": "...", "price": 0, "quantity": 1, "inStock": true}],
  "subtotal": 0,
  "tax": 0,
  "shipping": 0,
  "total": 0,
  "currency": "USD",
  "promoCode": null,
  "discount": 0
}

If cart is empty, return empty items array. Extract actual values from the page.`,
                        },
                    ],
                }],
        });
        try {
            const text = response.content[0].type === 'text' ? response.content[0].text : '';
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        }
        catch {
            // Fall through to default
        }
        return {
            items: [],
            subtotal: 0,
            total: 0,
            currency: 'USD',
        };
    }
    async proceedToCheckout(cdpController) {
        if (!await this.circuitBreaker.canExecute()) {
            return { success: false, error: 'Circuit breaker open' };
        }
        try {
            const platform = await this.detectPlatform(cdpController);
            const selectors = this.platformSelectors.get(platform) || this.platformSelectors.get('generic');
            // Navigate to cart first
            const cartClicked = await this.clickFirstMatch(cdpController, selectors.cart);
            if (cartClicked) {
                await this.delay(1000);
                await this.waitForPageLoad(cdpController);
            }
            // Click checkout button
            const checkoutClicked = await this.clickFirstMatch(cdpController, selectors.checkout);
            if (!checkoutClicked) {
                throw new Error('Could not find checkout button');
            }
            await this.delay(2000);
            await this.waitForPageLoad(cdpController);
            const urlResult = await cdpController.send('Runtime.evaluate', {
                expression: 'window.location.href',
                returnByValue: true,
            });
            this.circuitBreaker.recordSuccess();
            return { success: true, checkoutUrl: urlResult.result.value };
        }
        catch (error) {
            this.circuitBreaker.recordFailure();
            return { success: false, error: error.message };
        }
    }
    async fillCheckoutForm(cdpController, checkoutData) {
        try {
            const eventBus = (0, event_bus_1.getEventBus)();
            eventBus.publish({
                type: 'agent.action_started',
                agentName: this.name,
                action: 'fill_checkout',
                timestamp: Date.now(),
            });
            // Common checkout field selectors
            const fieldMappings = {
                email: ['input[name*="email"]', '#email', '[type="email"]'],
                firstName: ['input[name*="first"]', '#firstName', '[autocomplete="given-name"]'],
                lastName: ['input[name*="last"]', '#lastName', '[autocomplete="family-name"]'],
                address1: ['input[name*="address1"]', 'input[name*="street"]', '[autocomplete="address-line1"]'],
                address2: ['input[name*="address2"]', '[autocomplete="address-line2"]'],
                city: ['input[name*="city"]', '#city', '[autocomplete="address-level2"]'],
                state: ['select[name*="state"]', 'input[name*="state"]', '[autocomplete="address-level1"]'],
                postalCode: ['input[name*="zip"]', 'input[name*="postal"]', '[autocomplete="postal-code"]'],
                country: ['select[name*="country"]', '[autocomplete="country"]'],
                phone: ['input[name*="phone"]', '[type="tel"]', '[autocomplete="tel"]'],
            };
            // Fill email
            await this.fillField(cdpController, fieldMappings.email, checkoutData.email);
            await this.delay(200);
            // Fill shipping address
            const shipping = checkoutData.shipping;
            await this.fillField(cdpController, fieldMappings.firstName, shipping.firstName);
            await this.fillField(cdpController, fieldMappings.lastName, shipping.lastName);
            await this.fillField(cdpController, fieldMappings.address1, shipping.address1);
            if (shipping.address2) {
                await this.fillField(cdpController, fieldMappings.address2, shipping.address2);
            }
            await this.fillField(cdpController, fieldMappings.city, shipping.city);
            await this.fillField(cdpController, fieldMappings.state, shipping.state);
            await this.fillField(cdpController, fieldMappings.postalCode, shipping.postalCode);
            await this.fillField(cdpController, fieldMappings.country, shipping.country);
            if (shipping.phone) {
                await this.fillField(cdpController, fieldMappings.phone, shipping.phone);
            }
            eventBus.publish({
                type: 'agent.action_completed',
                agentName: this.name,
                action: 'fill_checkout',
                success: true,
                timestamp: Date.now(),
            });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    async applyPromoCode(cdpController, code) {
        try {
            const platform = await this.detectPlatform(cdpController);
            const selectors = this.platformSelectors.get(platform) || this.platformSelectors.get('generic');
            // Find and fill promo code field
            const filled = await this.fillField(cdpController, selectors.promoCode, code);
            if (!filled) {
                throw new Error('Could not find promo code field');
            }
            await this.delay(300);
            // Click apply button
            const applied = await this.clickFirstMatch(cdpController, selectors.applyPromo);
            if (!applied) {
                // Try pressing Enter instead
                await cdpController.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter' });
                await cdpController.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter' });
            }
            await this.delay(1500);
            // Check for discount applied
            const cartState = await this.getCartState(cdpController, selectors);
            return {
                success: (cartState.discount || 0) > 0,
                discount: cartState.discount,
            };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    async detectPlatform(cdpController) {
        const result = await cdpController.send('Runtime.evaluate', {
            expression: `
        (function() {
          if (window.Shopify) return 'shopify';
          if (document.querySelector('.woocommerce')) return 'woocommerce';
          if (window.location.hostname.includes('amazon')) return 'amazon';
          if (window.location.hostname.includes('ebay')) return 'ebay';
          if (window.location.hostname.includes('walmart')) return 'walmart';
          if (window.location.hostname.includes('target')) return 'target';
          return 'generic';
        })()
      `,
            returnByValue: true,
        });
        return result.result.value || 'generic';
    }
    async selectVariant(cdpController, variantType, value, selectors) {
        // Try to find and click variant option
        for (const selector of selectors.variant) {
            const result = await cdpController.send('Runtime.evaluate', {
                expression: `
          (function() {
            const elements = document.querySelectorAll('${selector}');
            for (const el of elements) {
              if (el.textContent.toLowerCase().includes('${value.toLowerCase()}') ||
                  el.value?.toLowerCase() === '${value.toLowerCase()}') {
                el.click();
                return true;
              }
            }
            return false;
          })()
        `,
                returnByValue: true,
            });
            if (result.result.value)
                return true;
        }
        return false;
    }
    async setQuantity(cdpController, quantity, selectors) {
        for (const selector of selectors.quantity) {
            const result = await cdpController.send('Runtime.evaluate', {
                expression: `
          (function() {
            const el = document.querySelector('${selector}');
            if (el) {
              if (el.tagName === 'SELECT') {
                el.value = '${quantity}';
              } else {
                el.value = ${quantity};
              }
              el.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
            return false;
          })()
        `,
                returnByValue: true,
            });
            if (result.result.value)
                return true;
        }
        return false;
    }
    async clickFirstMatch(cdpController, selectors) {
        for (const selector of selectors) {
            const result = await cdpController.send('Runtime.evaluate', {
                expression: `
          (function() {
            const el = document.querySelector('${selector}');
            if (el && el.offsetParent !== null) {
              el.click();
              return true;
            }
            return false;
          })()
        `,
                returnByValue: true,
            });
            if (result.result.value)
                return true;
        }
        return false;
    }
    async fillField(cdpController, selectors, value) {
        for (const selector of selectors) {
            const result = await cdpController.send('Runtime.evaluate', {
                expression: `
          (function() {
            const el = document.querySelector('${selector}');
            if (el && el.offsetParent !== null) {
              el.focus();
              if (el.tagName === 'SELECT') {
                const option = Array.from(el.options).find(o => 
                  o.text.toLowerCase().includes('${value.toLowerCase()}') ||
                  o.value.toLowerCase() === '${value.toLowerCase()}'
                );
                if (option) {
                  el.value = option.value;
                  el.dispatchEvent(new Event('change', { bubbles: true }));
                  return true;
                }
              } else {
                el.value = '${value.replace(/'/g, "\\'")}';
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
              }
            }
            return false;
          })()
        `,
                returnByValue: true,
            });
            if (result.result.value)
                return true;
        }
        return false;
    }
    async waitForPageLoad(cdpController, timeout = 10000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const result = await cdpController.send('Runtime.evaluate', {
                expression: 'document.readyState',
                returnByValue: true,
            });
            if (result.result.value === 'complete')
                return;
            await this.delay(200);
        }
    }
    async waitForCartUpdate(cdpController, timeout = 5000) {
        // Wait for common cart update indicators to disappear
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const result = await cdpController.send('Runtime.evaluate', {
                expression: `
          !document.querySelector('[class*="loading"]') &&
          !document.querySelector('[class*="spinner"]') &&
          !document.querySelector('.cart-loading')
        `,
                returnByValue: true,
            });
            if (result.result.value)
                return;
            await this.delay(200);
        }
    }
    delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
}
exports.TheEcommerceExpert = TheEcommerceExpert;
__decorate([
    (0, event_bus_1.traced)('ecommerce_expert'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TheEcommerceExpert.prototype, "addToCart", null);
__decorate([
    (0, event_bus_1.traced)('ecommerce_expert'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TheEcommerceExpert.prototype, "getCartState", null);
__decorate([
    (0, event_bus_1.traced)('ecommerce_expert'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TheEcommerceExpert.prototype, "proceedToCheckout", null);
__decorate([
    (0, event_bus_1.traced)('ecommerce_expert'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TheEcommerceExpert.prototype, "fillCheckoutForm", null);
__decorate([
    (0, event_bus_1.traced)('ecommerce_expert'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], TheEcommerceExpert.prototype, "applyPromoCode", null);
// =============================================================================
// AGENT 23: THE DATA EXTRACTOR
// =============================================================================
class TheDataExtractor extends tier0_orchestration_1.BaseAgent {
    client;
    extractionCache;
    circuitBreaker;
    constructor() {
        super('THE_DATA_EXTRACTOR', { model: 'sonnet' });
        this.client = new sdk_1.default();
        this.extractionCache = new Map();
        this.circuitBreaker = new event_bus_1.CircuitBreaker({
            name: 'data_extractor',
            threshold: 5,
            resetTimeout: 30000,
        });
    }
    async extractTable(cdpController, tableSelector) {
        const eventBus = (0, event_bus_1.getEventBus)();
        eventBus.publish({
            type: 'agent.action_started',
            agentName: this.name,
            action: 'extract_table',
            timestamp: Date.now(),
        });
        try {
            const selector = tableSelector || 'table';
            const result = await cdpController.send('Runtime.evaluate', {
                expression: `
          (function() {
            const table = document.querySelector('${selector}');
            if (!table) return null;
            
            const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
            const rows = Array.from(table.querySelectorAll('tbody tr')).map(row => {
              const cells = Array.from(row.querySelectorAll('td'));
              const rowData = {};
              cells.forEach((cell, i) => {
                const header = headers[i] || 'column_' + i;
                rowData[header] = cell.textContent.trim();
              });
              return rowData;
            });
            
            return { headers, rows };
          })()
        `,
                returnByValue: true,
            });
            if (!result.result.value) {
                throw new Error('No table found');
            }
            const { headers, rows } = result.result.value;
            const schema = {};
            headers.forEach((h) => {
                schema[h] = 'string';
            });
            const urlResult = await cdpController.send('Runtime.evaluate', {
                expression: 'window.location.href',
                returnByValue: true,
            });
            const extracted = {
                type: 'table',
                schema,
                data: rows,
                sourceUrl: urlResult.result.value,
                extractedAt: Date.now(),
                confidence: 0.95,
            };
            this.extractionCache.set(extracted.sourceUrl, extracted);
            return extracted;
        }
        catch (error) {
            throw error;
        }
    }
    async extractWithRules(cdpController, rules) {
        const eventBus = (0, event_bus_1.getEventBus)();
        eventBus.publish({
            type: 'agent.action_started',
            agentName: this.name,
            action: 'extract_with_rules',
            timestamp: Date.now(),
        });
        try {
            const rulesJson = JSON.stringify(rules);
            const result = await cdpController.send('Runtime.evaluate', {
                expression: `
          (function() {
            const rules = ${rulesJson};
            const results = [];
            
            // Find all matching container elements
            const containers = document.querySelectorAll('[class*="item"], [class*="card"], [class*="product"], [class*="result"], article, li');
            
            containers.forEach(container => {
              const item = {};
              let hasData = false;
              
              rules.forEach(rule => {
                const el = container.querySelector(rule.selector);
                if (el) {
                  let value;
                  if (rule.attribute === 'text' || !rule.attribute) {
                    value = el.textContent.trim();
                  } else if (rule.attribute === 'href') {
                    value = el.href;
                  } else if (rule.attribute === 'src') {
                    value = el.src;
                  } else {
                    value = el.getAttribute(rule.attribute);
                  }
                  
                  if (value) {
                    if (rule.transform === 'number') {
                      value = parseFloat(value.replace(/[^0-9.]/g, ''));
                    } else if (rule.transform === 'lowercase') {
                      value = value.toLowerCase();
                    } else if (rule.transform === 'trim') {
                      value = value.trim();
                    }
                    item[rule.name] = value;
                    hasData = true;
                  }
                }
              });
              
              if (hasData) results.push(item);
            });
            
            return results;
          })()
        `,
                returnByValue: true,
            });
            const schema = {};
            rules.forEach(rule => {
                schema[rule.name] = rule.transform === 'number' ? 'number' : 'string';
            });
            const urlResult = await cdpController.send('Runtime.evaluate', {
                expression: 'window.location.href',
                returnByValue: true,
            });
            const extracted = {
                type: 'custom',
                schema,
                data: result.result.value || [],
                sourceUrl: urlResult.result.value,
                extractedAt: Date.now(),
                confidence: 0.85,
            };
            return extracted;
        }
        catch (error) {
            throw error;
        }
    }
    async extractProducts(cdpController) {
        if (!await this.circuitBreaker.canExecute()) {
            throw new Error('Circuit breaker open');
        }
        try {
            // Use Claude Vision for intelligent product extraction
            const screenshot = await cdpController.send('Page.captureScreenshot', { format: 'png' });
            const htmlResult = await cdpController.send('Runtime.evaluate', {
                expression: `
          document.body.innerHTML.substring(0, 50000)
        `,
                returnByValue: true,
            });
            const response = await this.client.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 4000,
                messages: [{
                        role: 'user',
                        content: [
                            {
                                type: 'image',
                                source: { type: 'base64', media_type: 'image/png', data: screenshot.data },
                            },
                            {
                                type: 'text',
                                text: `Extract all products/items from this page. For each product, extract:
- name: Product name
- price: Price (number only)
- currency: Currency symbol
- url: Product link if visible
- image: Image URL if visible
- rating: Rating if shown
- reviews: Number of reviews
- inStock: true/false

Return as JSON array:
[{"name": "...", "price": 0, "currency": "$", "inStock": true, ...}]

HTML snippet for reference:
${htmlResult.result.value?.substring(0, 5000)}`,
                            },
                        ],
                    }],
            });
            const text = response.content[0].type === 'text' ? response.content[0].text : '';
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            const products = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
            const urlResult = await cdpController.send('Runtime.evaluate', {
                expression: 'window.location.href',
                returnByValue: true,
            });
            this.circuitBreaker.recordSuccess();
            return {
                type: 'product',
                schema: {
                    name: 'string',
                    price: 'number',
                    currency: 'string',
                    url: 'string',
                    image: 'string',
                    rating: 'number',
                    reviews: 'number',
                    inStock: 'boolean',
                },
                data: products,
                sourceUrl: urlResult.result.value,
                extractedAt: Date.now(),
                confidence: 0.88,
            };
        }
        catch (error) {
            this.circuitBreaker.recordFailure();
            throw error;
        }
    }
    async extractContactInfo(cdpController) {
        try {
            const result = await cdpController.send('Runtime.evaluate', {
                expression: `
          (function() {
            const text = document.body.innerText;
            
            // Email regex
            const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/g) || [];
            
            // Phone regex (various formats)
            const phones = text.match(/(?:\\+?1[-.]?)?\\(?\\d{3}\\)?[-.]?\\d{3}[-.]?\\d{4}/g) || [];
            
            // Address pattern (basic)
            const addressPattern = /\\d+\\s+[\\w\\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way)[\\s,]*[\\w\\s]*,?\\s*[A-Z]{2}\\s*\\d{5}/gi;
            const addresses = text.match(addressPattern) || [];
            
            // Social links
            const socialLinks = [];
            document.querySelectorAll('a[href*="facebook.com"], a[href*="twitter.com"], a[href*="linkedin.com"], a[href*="instagram.com"]').forEach(a => {
              socialLinks.push(a.href);
            });
            
            return {
              emails: [...new Set(emails)],
              phones: [...new Set(phones)],
              addresses: [...new Set(addresses)],
              socialLinks: [...new Set(socialLinks)],
            };
          })()
        `,
                returnByValue: true,
            });
            const urlResult = await cdpController.send('Runtime.evaluate', {
                expression: 'window.location.href',
                returnByValue: true,
            });
            const data = result.result.value;
            return {
                type: 'contact',
                schema: {
                    emails: 'array',
                    phones: 'array',
                    addresses: 'array',
                    socialLinks: 'array',
                },
                data: [data],
                sourceUrl: urlResult.result.value,
                extractedAt: Date.now(),
                confidence: 0.9,
            };
        }
        catch (error) {
            throw error;
        }
    }
    async extractArticle(cdpController) {
        try {
            // Use readability-style extraction
            const result = await cdpController.send('Runtime.evaluate', {
                expression: `
          (function() {
            // Try to find article content
            const article = document.querySelector('article') || 
                           document.querySelector('[role="article"]') ||
                           document.querySelector('.post-content') ||
                           document.querySelector('.article-body') ||
                           document.querySelector('main');
            
            if (!article) return null;
            
            // Get title
            const title = document.querySelector('h1')?.textContent?.trim() ||
                         document.querySelector('title')?.textContent?.trim() || '';
            
            // Get author
            const authorEl = document.querySelector('[rel="author"]') ||
                            document.querySelector('.author') ||
                            document.querySelector('[class*="byline"]');
            const author = authorEl?.textContent?.trim() || '';
            
            // Get publish date
            const dateEl = document.querySelector('time') ||
                          document.querySelector('[class*="date"]') ||
                          document.querySelector('[class*="publish"]');
            const publishDate = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || '';
            
            // Get main content
            const paragraphs = Array.from(article.querySelectorAll('p'))
              .map(p => p.textContent.trim())
              .filter(t => t.length > 50);
            
            return {
              title,
              author,
              publishDate,
              content: paragraphs.join('\\n\\n'),
              wordCount: paragraphs.join(' ').split(/\\s+/).length,
            };
          })()
        `,
                returnByValue: true,
            });
            const urlResult = await cdpController.send('Runtime.evaluate', {
                expression: 'window.location.href',
                returnByValue: true,
            });
            if (!result.result.value) {
                throw new Error('No article content found');
            }
            return {
                type: 'article',
                schema: {
                    title: 'string',
                    author: 'string',
                    publishDate: 'string',
                    content: 'string',
                    wordCount: 'number',
                },
                data: [result.result.value],
                sourceUrl: urlResult.result.value,
                extractedAt: Date.now(),
                confidence: 0.85,
            };
        }
        catch (error) {
            throw error;
        }
    }
    async scrapeWithPagination(cdpController, extractFn, nextButtonSelector, maxPages = 10) {
        const allData = [];
        let schema = {};
        let currentPage = 1;
        while (currentPage <= maxPages) {
            const pageData = await extractFn();
            allData.push(...pageData.data);
            schema = pageData.schema;
            // Try to click next button
            const result = await cdpController.send('Runtime.evaluate', {
                expression: `
          (function() {
            const next = document.querySelector('${nextButtonSelector}');
            if (next && !next.disabled && next.offsetParent !== null) {
              next.click();
              return true;
            }
            return false;
          })()
        `,
                returnByValue: true,
            });
            if (!result.result.value)
                break;
            // Wait for page load
            await new Promise(r => setTimeout(r, 2000));
            currentPage++;
        }
        const urlResult = await cdpController.send('Runtime.evaluate', {
            expression: 'window.location.href',
            returnByValue: true,
        });
        return {
            type: 'custom',
            schema,
            data: allData,
            sourceUrl: urlResult.result.value,
            extractedAt: Date.now(),
            confidence: 0.8,
        };
    }
}
exports.TheDataExtractor = TheDataExtractor;
__decorate([
    (0, event_bus_1.traced)('data_extractor'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], TheDataExtractor.prototype, "extractTable", null);
__decorate([
    (0, event_bus_1.traced)('data_extractor'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Array]),
    __metadata("design:returntype", Promise)
], TheDataExtractor.prototype, "extractWithRules", null);
__decorate([
    (0, event_bus_1.traced)('data_extractor'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TheDataExtractor.prototype, "extractProducts", null);
__decorate([
    (0, event_bus_1.traced)('data_extractor'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TheDataExtractor.prototype, "extractContactInfo", null);
__decorate([
    (0, event_bus_1.traced)('data_extractor'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TheDataExtractor.prototype, "extractArticle", null);
__decorate([
    (0, event_bus_1.traced)('data_extractor'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Function, String, Number]),
    __metadata("design:returntype", Promise)
], TheDataExtractor.prototype, "scrapeWithPagination", null);
// =============================================================================
// AGENT 24: THE RESEARCH AGENT
// =============================================================================
class TheResearchAgent extends tier0_orchestration_1.BaseAgent {
    client;
    researchCache;
    circuitBreaker;
    constructor() {
        super('THE_RESEARCH_AGENT', { model: 'opus' });
        this.client = new sdk_1.default();
        this.researchCache = new Map();
        this.circuitBreaker = new event_bus_1.CircuitBreaker({
            name: 'research_agent',
            threshold: 3,
            resetTimeout: 60000,
        });
    }
    async research(cdpController, query) {
        if (!await this.circuitBreaker.canExecute()) {
            throw new Error('Circuit breaker open - too many failures');
        }
        const eventBus = (0, event_bus_1.getEventBus)();
        eventBus.publish({
            type: 'agent.action_started',
            agentName: this.name,
            action: 'research',
            timestamp: Date.now(),
        });
        try {
            const maxSources = query.maxSources || (query.depth === 'shallow' ? 3 : query.depth === 'medium' ? 5 : 10);
            const sources = [];
            // Build search query
            let searchQuery = query.topic;
            if (query.timeRange && query.timeRange !== 'all') {
                const timeMap = {
                    day: 'past 24 hours',
                    week: 'past week',
                    month: 'past month',
                    year: 'past year',
                };
                searchQuery += ` ${timeMap[query.timeRange]}`;
            }
            // Use specified sources or search
            const sourcesToVisit = query.sources || [];
            if (sourcesToVisit.length === 0) {
                // Navigate to Google and search
                await cdpController.send('Page.navigate', { url: `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}` });
                await this.waitForPageLoad(cdpController);
                await this.delay(1000);
                // Extract search results
                const searchResults = await cdpController.send('Runtime.evaluate', {
                    expression: `
            (function() {
              const results = [];
              document.querySelectorAll('.g').forEach((el, i) => {
                if (i >= ${maxSources * 2}) return;
                const link = el.querySelector('a[href^="http"]');
                const title = el.querySelector('h3');
                const snippet = el.querySelector('.VwiC3b');
                if (link && title) {
                  results.push({
                    url: link.href,
                    title: title.textContent,
                    snippet: snippet?.textContent || '',
                  });
                }
              });
              return results;
            })()
          `,
                    returnByValue: true,
                });
                const searchHits = searchResults.result.value || [];
                for (const hit of searchHits.slice(0, maxSources)) {
                    // Filter excluded domains
                    if (query.excludeDomains?.some(d => hit.url.includes(d)))
                        continue;
                    sourcesToVisit.push(hit.url);
                }
            }
            // Visit each source and extract content
            for (const url of sourcesToVisit.slice(0, maxSources)) {
                try {
                    await cdpController.send('Page.navigate', { url });
                    await this.waitForPageLoad(cdpController);
                    await this.delay(1500);
                    // Extract main content
                    const contentResult = await cdpController.send('Runtime.evaluate', {
                        expression: `
              (function() {
                const article = document.querySelector('article') || document.querySelector('main') || document.body;
                const title = document.querySelector('h1')?.textContent || document.title;
                const paragraphs = Array.from(article.querySelectorAll('p'))
                  .map(p => p.textContent.trim())
                  .filter(t => t.length > 30)
                  .slice(0, 20);
                return {
                  title: title.trim(),
                  content: paragraphs.join('\\n'),
                };
              })()
            `,
                        returnByValue: true,
                    });
                    const content = contentResult.result.value;
                    sources.push({
                        url,
                        title: content.title,
                        snippet: content.content.substring(0, 500),
                        relevance: 0.8,
                        extractedData: { fullContent: content.content },
                    });
                }
                catch {
                    // Skip failed sources
                    continue;
                }
            }
            // Use Claude to synthesize findings
            const synthesisPrompt = `Research Topic: ${query.topic}

Sources analyzed:
${sources.map((s, i) => `
${i + 1}. ${s.title} (${s.url})
${s.extractedData?.fullContent || s.snippet}
`).join('\n---\n')}

Please provide:
1. A comprehensive summary of the findings (2-3 paragraphs)
2. 5-7 key findings as bullet points
3. Rate each source's relevance (0.0-1.0)

Format your response as JSON:
{
  "summary": "...",
  "keyFindings": ["...", "..."],
  "sourceRelevance": [0.9, 0.8, ...]
}`;
            const synthesisResponse = await this.client.messages.create({
                model: query.depth === 'deep' ? 'claude-opus-4-20250514' : 'claude-sonnet-4-20250514',
                max_tokens: 3000,
                messages: [{ role: 'user', content: synthesisPrompt }],
            });
            const synthesisText = synthesisResponse.content[0].type === 'text' ? synthesisResponse.content[0].text : '';
            let synthesis;
            try {
                const jsonMatch = synthesisText.match(/\{[\s\S]*\}/);
                synthesis = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: synthesisText, keyFindings: [], sourceRelevance: [] };
            }
            catch {
                synthesis = { summary: synthesisText, keyFindings: [], sourceRelevance: [] };
            }
            // Update source relevance scores
            sources.forEach((source, i) => {
                source.relevance = synthesis.sourceRelevance[i] || 0.5;
            });
            const result = {
                query: query.topic,
                summary: synthesis.summary,
                keyFindings: synthesis.keyFindings,
                sources,
                confidence: sources.length >= 3 ? 0.85 : 0.6,
                completedAt: Date.now(),
            };
            this.researchCache.set(query.topic, result);
            this.circuitBreaker.recordSuccess();
            eventBus.publish({
                type: 'agent.action_completed',
                agentName: this.name,
                action: 'research',
                success: true,
                timestamp: Date.now(),
            });
            return result;
        }
        catch (error) {
            this.circuitBreaker.recordFailure();
            throw error;
        }
    }
    async compareProducts(cdpController, products, criteria) {
        const query = {
            topic: `Compare ${products.join(' vs ')} - ${criteria.join(', ')}`,
            depth: 'medium',
            maxSources: products.length * 2,
        };
        const result = await this.research(cdpController, query);
        // Enhance with structured comparison
        const comparisonPrompt = `Based on this research:
${result.summary}

Create a structured comparison of ${products.join(' vs ')} across these criteria:
${criteria.map(c => `- ${c}`).join('\n')}

Return as JSON:
{
  "comparison": [
    {"product": "...", "criteria": {"criterion1": "value", ...}, "overallScore": 0-10}
  ],
  "recommendation": "...",
  "winner": "..."
}`;
        const compResponse = await this.client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2000,
            messages: [{ role: 'user', content: comparisonPrompt }],
        });
        const compText = compResponse.content[0].type === 'text' ? compResponse.content[0].text : '';
        try {
            const jsonMatch = compText.match(/\{[\s\S]*\}/);
            const comparison = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
            result.keyFindings.unshift(`Winner: ${comparison.winner}`);
            result.keyFindings.push(comparison.recommendation);
        }
        catch {
            // Keep original result
        }
        return result;
    }
    async factCheck(cdpController, claim) {
        const query = {
            topic: `fact check: ${claim}`,
            depth: 'medium',
            maxSources: 5,
        };
        const result = await this.research(cdpController, query);
        const factCheckPrompt = `Claim to verify: "${claim}"

Research findings:
${result.summary}

Sources:
${result.sources.map(s => `- ${s.title}: ${s.snippet}`).join('\n')}

Determine:
1. Is the claim TRUE, FALSE, MIXED (partially true), or UNVERIFIED?
2. What evidence supports or refutes it?
3. How confident are you (0.0-1.0)?

Return JSON:
{
  "verdict": "true|false|mixed|unverified",
  "confidence": 0.0-1.0,
  "evidence": ["supporting or refuting evidence..."]
}`;
        const response = await this.client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1500,
            messages: [{ role: 'user', content: factCheckPrompt }],
        });
        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
            return {
                claim,
                verdict: parsed.verdict || 'unverified',
                confidence: parsed.confidence || 0.5,
                evidence: parsed.evidence || [],
                sources: result.sources.map(s => s.url),
            };
        }
        catch {
            return {
                claim,
                verdict: 'unverified',
                confidence: 0.3,
                evidence: [],
                sources: result.sources.map(s => s.url),
            };
        }
    }
    async waitForPageLoad(cdpController, timeout = 10000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const result = await cdpController.send('Runtime.evaluate', {
                expression: 'document.readyState',
                returnByValue: true,
            });
            if (result.result.value === 'complete')
                return;
            await this.delay(200);
        }
    }
    delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
}
exports.TheResearchAgent = TheResearchAgent;
__decorate([
    (0, event_bus_1.traced)('research_agent'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TheResearchAgent.prototype, "research", null);
__decorate([
    (0, event_bus_1.traced)('research_agent'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Array, Array]),
    __metadata("design:returntype", Promise)
], TheResearchAgent.prototype, "compareProducts", null);
__decorate([
    (0, event_bus_1.traced)('research_agent'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], TheResearchAgent.prototype, "factCheck", null);
class TheBookingAgent extends tier0_orchestration_1.BaseAgent {
    client;
    platformConfigs;
    circuitBreaker;
    constructor() {
        super('THE_BOOKING_AGENT', { model: 'sonnet' });
        this.client = new sdk_1.default();
        this.platformConfigs = this.initPlatformConfigs();
        this.circuitBreaker = new event_bus_1.CircuitBreaker({
            name: 'booking_agent',
            threshold: 3,
            resetTimeout: 60000,
        });
    }
    initPlatformConfigs() {
        const configs = new Map();
        configs.set('booking.com', {
            url: 'https://www.booking.com',
            searchSelector: 'input[name="ss"]',
            dateSelector: '[data-testid="date-display-field-start"]',
            guestsSelector: '[data-testid="occupancy-config"]',
            submitSelector: 'button[type="submit"]',
            resultSelector: '[data-testid="property-card"]',
            bookButtonSelector: '[data-testid="cta-button"]',
        });
        configs.set('opentable', {
            url: 'https://www.opentable.com',
            searchSelector: '#restProfileSuggestAutoComplete',
            dateSelector: '#dateTimePicker',
            guestsSelector: '#selectPartySizeButton',
            submitSelector: '.searchButton',
            resultSelector: '.RestaurantCard',
            bookButtonSelector: '.ReservationButton',
        });
        configs.set('calendly', {
            url: 'https://calendly.com',
            searchSelector: 'input[type="text"]',
            dateSelector: '[data-component="calendar"]',
            guestsSelector: '',
            submitSelector: 'button[type="submit"]',
            resultSelector: '[data-component="spot-list"]',
            bookButtonSelector: '[data-component="confirm-button"]',
        });
        configs.set('airbnb', {
            url: 'https://www.airbnb.com',
            searchSelector: '[data-testid="structured-search-input-field-query"]',
            dateSelector: '[data-testid="structured-search-input-field-split-dates"]',
            guestsSelector: '[data-testid="structured-search-input-field-guests"]',
            submitSelector: '[data-testid="structured-search-input-search-button"]',
            resultSelector: '[itemprop="itemListElement"]',
            bookButtonSelector: '[data-testid="book-it-button"]',
        });
        return configs;
    }
    async searchAvailability(cdpController, request) {
        if (!await this.circuitBreaker.canExecute()) {
            throw new Error('Circuit breaker open');
        }
        const eventBus = (0, event_bus_1.getEventBus)();
        eventBus.publish({
            type: 'agent.action_started',
            agentName: this.name,
            action: 'search_availability',
            timestamp: Date.now(),
        });
        try {
            const platform = request.platform || this.detectPlatform(request.type);
            const config = this.platformConfigs.get(platform);
            if (!config) {
                // Use Claude Vision for unknown platforms
                return await this.searchWithVision(cdpController, request);
            }
            // Navigate to platform
            await cdpController.send('Page.navigate', { url: config.url });
            await this.waitForPageLoad(cdpController);
            await this.delay(1500);
            // Fill search criteria
            if (request.location) {
                await this.fillField(cdpController, config.searchSelector, request.location);
                await this.delay(1000);
            }
            // Set date
            await this.clickElement(cdpController, config.dateSelector);
            await this.delay(500);
            await this.selectDate(cdpController, request.date);
            await this.delay(500);
            // Set guests if applicable
            if (request.guests && config.guestsSelector) {
                await this.clickElement(cdpController, config.guestsSelector);
                await this.delay(300);
                await this.setGuests(cdpController, request.guests);
                await this.delay(300);
            }
            // Submit search
            await this.clickElement(cdpController, config.submitSelector);
            await this.waitForPageLoad(cdpController);
            await this.delay(2000);
            // Extract results
            const results = await this.extractResults(cdpController, config.resultSelector);
            this.circuitBreaker.recordSuccess();
            return {
                available: results.length > 0,
                options: results,
            };
        }
        catch (error) {
            this.circuitBreaker.recordFailure();
            throw error;
        }
    }
    async makeBooking(cdpController, request, optionIndex = 0) {
        const eventBus = (0, event_bus_1.getEventBus)();
        eventBus.publish({
            type: 'agent.action_started',
            agentName: this.name,
            action: 'make_booking',
            timestamp: Date.now(),
        });
        try {
            const platform = request.platform || this.detectPlatform(request.type);
            const config = this.platformConfigs.get(platform);
            // First search for availability
            const availability = await this.searchAvailability(cdpController, request);
            if (!availability.available || availability.options.length <= optionIndex) {
                return {
                    success: false,
                    details: {
                        date: request.date,
                        time: request.time,
                        location: request.location,
                    },
                };
            }
            // Select the option
            await cdpController.send('Runtime.evaluate', {
                expression: `
          (function() {
            const results = document.querySelectorAll('${config?.resultSelector || '[class*="result"], [class*="card"]'}');
            if (results[${optionIndex}]) {
              const bookBtn = results[${optionIndex}].querySelector('${config?.bookButtonSelector || 'button, a[href*="book"]'}');
              if (bookBtn) {
                bookBtn.click();
                return true;
              }
              results[${optionIndex}].click();
              return true;
            }
            return false;
          })()
        `,
                returnByValue: true,
            });
            await this.waitForPageLoad(cdpController);
            await this.delay(2000);
            // Fill contact information
            await this.fillBookingForm(cdpController, request.contactInfo);
            // Use Claude Vision to complete remaining steps
            const screenshot = await cdpController.send('Page.captureScreenshot', { format: 'png' });
            const response = await this.client.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1500,
                messages: [{
                        role: 'user',
                        content: [
                            {
                                type: 'image',
                                source: { type: 'base64', media_type: 'image/png', data: screenshot.data },
                            },
                            {
                                type: 'text',
                                text: `Analyze this booking confirmation page and extract:
1. Is the booking confirmed?
2. Confirmation number if visible
3. Date and time of booking
4. Total price if shown
5. Cancellation policy if visible

Return as JSON:
{
  "confirmed": true/false,
  "confirmationNumber": "...",
  "date": "...",
  "time": "...",
  "totalPrice": 0,
  "currency": "USD",
  "cancellationPolicy": "..."
}`,
                            },
                        ],
                    }],
            });
            const text = response.content[0].type === 'text' ? response.content[0].text : '';
            try {
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                const result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
                return {
                    success: result.confirmed || false,
                    confirmationNumber: result.confirmationNumber,
                    details: {
                        date: result.date || request.date,
                        time: result.time || request.time,
                        location: request.location,
                        totalPrice: result.totalPrice,
                        currency: result.currency,
                    },
                    cancellationPolicy: result.cancellationPolicy,
                };
            }
            catch {
                return {
                    success: false,
                    details: {
                        date: request.date,
                        time: request.time,
                        location: request.location,
                    },
                };
            }
        }
        catch (error) {
            return {
                success: false,
                details: {
                    date: request.date,
                    time: request.time,
                    location: request.location,
                },
            };
        }
    }
    detectPlatform(type) {
        const platformMap = {
            hotel: 'booking.com',
            restaurant: 'opentable',
            appointment: 'calendly',
            rental: 'airbnb',
        };
        return platformMap[type] || 'generic';
    }
    async searchWithVision(cdpController, request) {
        const screenshot = await cdpController.send('Page.captureScreenshot', { format: 'png' });
        const response = await this.client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2000,
            messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: { type: 'base64', media_type: 'image/png', data: screenshot.data },
                        },
                        {
                            type: 'text',
                            text: `This is a booking page. Extract available options for:
Type: ${request.type}
Date: ${request.date}
Time: ${request.time || 'any'}
Location: ${request.location || 'any'}
Guests: ${request.guests || 1}

Return as JSON:
{
  "available": true/false,
  "options": [{"name": "...", "time": "...", "price": 0, "details": "..."}]
}`,
                        },
                    ],
                }],
        });
        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            return jsonMatch ? JSON.parse(jsonMatch[0]) : { available: false, options: [] };
        }
        catch {
            return { available: false, options: [] };
        }
    }
    async fillField(cdpController, selector, value) {
        await cdpController.send('Runtime.evaluate', {
            expression: `
        (function() {
          const el = document.querySelector('${selector}');
          if (el) {
            el.focus();
            el.value = '${value.replace(/'/g, "\\'")}';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        })()
      `,
        });
    }
    async clickElement(cdpController, selector) {
        await cdpController.send('Runtime.evaluate', {
            expression: `
        (function() {
          const el = document.querySelector('${selector}');
          if (el) el.click();
        })()
      `,
        });
    }
    async selectDate(cdpController, dateStr) {
        const date = new Date(dateStr);
        const day = date.getDate();
        const month = date.toLocaleString('default', { month: 'long' });
        await cdpController.send('Runtime.evaluate', {
            expression: `
        (function() {
          // Try common date picker patterns
          const dayButton = document.querySelector('[data-date="${dateStr}"], [aria-label*="${month} ${day}"], button:contains("${day}")');
          if (dayButton) {
            dayButton.click();
            return true;
          }
          
          // Try clicking calendar day
          const days = document.querySelectorAll('[class*="day"], [class*="calendar"] button, td[data-day]');
          for (const d of days) {
            if (d.textContent.trim() === '${day}' && !d.disabled) {
              d.click();
              return true;
            }
          }
          return false;
        })()
      `,
        });
    }
    async setGuests(cdpController, guests) {
        await cdpController.send('Runtime.evaluate', {
            expression: `
        (function() {
          // Try to find and set guest count
          const guestInput = document.querySelector('input[name*="guest"], input[name*="people"], select[name*="party"]');
          if (guestInput) {
            guestInput.value = ${guests};
            guestInput.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
          
          // Try increment buttons
          const addBtn = document.querySelector('[aria-label*="add"], [aria-label*="increase"], button:contains("+")');
          if (addBtn) {
            for (let i = 1; i < ${guests}; i++) {
              addBtn.click();
            }
            return true;
          }
          return false;
        })()
      `,
        });
    }
    async extractResults(cdpController, selector) {
        const result = await cdpController.send('Runtime.evaluate', {
            expression: `
        (function() {
          const results = [];
          document.querySelectorAll('${selector}').forEach((el, i) => {
            if (i >= 10) return;
            
            const name = el.querySelector('h2, h3, [class*="title"], [class*="name"]')?.textContent?.trim() || '';
            const price = el.querySelector('[class*="price"]')?.textContent?.trim() || '';
            const time = el.querySelector('[class*="time"], time')?.textContent?.trim() || '';
            const details = el.querySelector('[class*="description"], [class*="detail"]')?.textContent?.trim() || '';
            
            if (name) {
              results.push({
                name,
                time: time || undefined,
                price: parseFloat(price.replace(/[^0-9.]/g, '')) || undefined,
                details: details || undefined,
              });
            }
          });
          return results;
        })()
      `,
            returnByValue: true,
        });
        return result.result.value || [];
    }
    async fillBookingForm(cdpController, contactInfo) {
        const fieldMappings = {
            name: ['input[name*="name"]', '#name', '[autocomplete="name"]'],
            email: ['input[name*="email"]', '#email', '[type="email"]'],
            phone: ['input[name*="phone"]', '#phone', '[type="tel"]'],
        };
        for (const [field, selectors] of Object.entries(fieldMappings)) {
            const value = contactInfo[field];
            if (value) {
                for (const selector of selectors) {
                    try {
                        await this.fillField(cdpController, selector, value);
                        break;
                    }
                    catch {
                        continue;
                    }
                }
            }
        }
    }
    async waitForPageLoad(cdpController, timeout = 10000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const result = await cdpController.send('Runtime.evaluate', {
                expression: 'document.readyState',
                returnByValue: true,
            });
            if (result.result.value === 'complete')
                return;
            await this.delay(200);
        }
    }
    delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
}
exports.TheBookingAgent = TheBookingAgent;
__decorate([
    (0, event_bus_1.traced)('booking_agent'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TheBookingAgent.prototype, "searchAvailability", null);
__decorate([
    (0, event_bus_1.traced)('booking_agent'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Number]),
    __metadata("design:returntype", Promise)
], TheBookingAgent.prototype, "makeBooking", null);
// =============================================================================
// AGENT 26: THE PAYMENT HANDLER
// =============================================================================
class ThePaymentHandler extends tier0_orchestration_1.BaseAgent {
    client;
    circuitBreaker;
    constructor() {
        super('THE_PAYMENT_HANDLER', { model: 'sonnet' });
        this.client = new sdk_1.default();
        this.circuitBreaker = new event_bus_1.CircuitBreaker({
            name: 'payment_handler',
            threshold: 2, // Very low threshold for payment operations
            resetTimeout: 120000, // 2 minute cooldown
        });
    }
    async detectPaymentForm(cdpController) {
        const result = await cdpController.send('Runtime.evaluate', {
            expression: `
        (function() {
          // Check for payment processor iframes
          const stripeFrame = document.querySelector('iframe[src*="stripe"], iframe[name*="stripe"]');
          const braintreeFrame = document.querySelector('iframe[src*="braintree"]');
          const paypalFrame = document.querySelector('iframe[src*="paypal"]');
          const squareFrame = document.querySelector('iframe[src*="square"]');
          
          // Check for native payment fields
          const cardNumber = document.querySelector('input[name*="card"], input[autocomplete="cc-number"]');
          const expiry = document.querySelector('input[name*="exp"], input[autocomplete="cc-exp"]');
          const cvv = document.querySelector('input[name*="cvv"], input[name*="cvc"], input[autocomplete="cc-csc"]');
          
          let type = 'unknown';
          let iframeDetected = false;
          
          if (stripeFrame) {
            type = 'stripe';
            iframeDetected = true;
          } else if (braintreeFrame) {
            type = 'braintree';
            iframeDetected = true;
          } else if (paypalFrame) {
            type = 'paypal';
            iframeDetected = true;
          } else if (squareFrame) {
            type = 'square';
            iframeDetected = true;
          } else if (cardNumber) {
            type = 'native';
          }
          
          const fields = [];
          if (cardNumber) fields.push('cardNumber');
          if (expiry) fields.push('expiry');
          if (cvv) fields.push('cvv');
          
          // Check for cardholder name
          if (document.querySelector('input[name*="cardholder"], input[name*="card_name"], input[autocomplete="cc-name"]')) {
            fields.push('cardholderName');
          }
          
          // Check for billing zip
          if (document.querySelector('input[name*="postal"], input[name*="zip"], input[autocomplete="billing postal-code"]')) {
            fields.push('billingZip');
          }
          
          return {
            detected: type !== 'unknown' || fields.length > 0,
            type,
            fields,
            iframeDetected,
          };
        })()
      `,
            returnByValue: true,
        });
        return result.result.value;
    }
    async fillPaymentForm(cdpController, paymentDetails) {
        if (!await this.circuitBreaker.canExecute()) {
            return { success: false, error: 'Circuit breaker open - payment operations paused for safety' };
        }
        const eventBus = (0, event_bus_1.getEventBus)();
        eventBus.publish({
            type: 'agent.action_started',
            agentName: this.name,
            action: 'fill_payment',
            timestamp: Date.now(),
        });
        try {
            // Detect form type
            const formInfo = await this.detectPaymentForm(cdpController);
            if (!formInfo.detected) {
                throw new Error('No payment form detected');
            }
            if (formInfo.iframeDetected) {
                // Cannot directly fill iframe-based payment forms
                // Return with instructions for manual entry
                return {
                    success: false,
                    error: `Detected ${formInfo.type} payment form in iframe. For security, payment details must be entered manually in ${formInfo.type} forms.`,
                };
            }
            // Fill native payment form
            const fieldMappings = {
                cardNumber: [
                    'input[name*="card_number"]',
                    'input[name*="cardnumber"]',
                    'input[autocomplete="cc-number"]',
                    'input[data-stripe="number"]',
                    '#card-number',
                ],
                expiry: [
                    'input[name*="expiry"]',
                    'input[name*="exp"]',
                    'input[autocomplete="cc-exp"]',
                    '#card-expiry',
                ],
                expiryMonth: [
                    'input[name*="exp_month"]',
                    'select[name*="month"]',
                    'input[autocomplete="cc-exp-month"]',
                ],
                expiryYear: [
                    'input[name*="exp_year"]',
                    'select[name*="year"]',
                    'input[autocomplete="cc-exp-year"]',
                ],
                cvv: [
                    'input[name*="cvv"]',
                    'input[name*="cvc"]',
                    'input[name*="security"]',
                    'input[autocomplete="cc-csc"]',
                    '#card-cvc',
                ],
                cardholderName: [
                    'input[name*="cardholder"]',
                    'input[name*="card_name"]',
                    'input[name*="name_on_card"]',
                    'input[autocomplete="cc-name"]',
                ],
                billingZip: [
                    'input[name*="postal"]',
                    'input[name*="zip"]',
                    'input[name*="billing_zip"]',
                    'input[autocomplete="billing postal-code"]',
                ],
            };
            // Fill card number with human-like typing
            await this.fillPaymentField(cdpController, fieldMappings.cardNumber, paymentDetails.cardNumber);
            await this.delay(300);
            // Fill expiry - check if combined or separate fields
            const hasCombinedExpiry = await this.checkFieldExists(cdpController, fieldMappings.expiry);
            if (hasCombinedExpiry) {
                const expiry = `${paymentDetails.expiryMonth}/${paymentDetails.expiryYear.slice(-2)}`;
                await this.fillPaymentField(cdpController, fieldMappings.expiry, expiry);
            }
            else {
                await this.fillPaymentField(cdpController, fieldMappings.expiryMonth, paymentDetails.expiryMonth);
                await this.delay(100);
                await this.fillPaymentField(cdpController, fieldMappings.expiryYear, paymentDetails.expiryYear);
            }
            await this.delay(200);
            // Fill CVV
            await this.fillPaymentField(cdpController, fieldMappings.cvv, paymentDetails.cvv);
            await this.delay(200);
            // Fill cardholder name
            await this.fillPaymentField(cdpController, fieldMappings.cardholderName, paymentDetails.cardholderName);
            // Fill billing zip if provided
            if (paymentDetails.billingZip) {
                await this.delay(200);
                await this.fillPaymentField(cdpController, fieldMappings.billingZip, paymentDetails.billingZip);
            }
            this.circuitBreaker.recordSuccess();
            eventBus.publish({
                type: 'agent.action_completed',
                agentName: this.name,
                action: 'fill_payment',
                success: true,
                timestamp: Date.now(),
            });
            return { success: true };
        }
        catch (error) {
            this.circuitBreaker.recordFailure();
            return { success: false, error: error.message };
        }
    }
    async clickPayButton(cdpController) {
        const eventBus = (0, event_bus_1.getEventBus)();
        eventBus.publish({
            type: 'agent.action_started',
            agentName: this.name,
            action: 'click_pay',
            timestamp: Date.now(),
        });
        try {
            const payButtonSelectors = [
                'button[type="submit"]:contains("Pay")',
                'button:contains("Place Order")',
                'button:contains("Complete Purchase")',
                'button:contains("Submit Payment")',
                'button:contains("Buy Now")',
                '[data-testid="submit-button"]',
                '.payment-submit',
                '#submit-payment',
                'input[type="submit"][value*="Pay"]',
            ];
            const result = await cdpController.send('Runtime.evaluate', {
                expression: `
          (function() {
            const selectors = ${JSON.stringify(payButtonSelectors)};
            
            // Also look for buttons with payment-related text
            const allButtons = document.querySelectorAll('button, input[type="submit"]');
            for (const btn of allButtons) {
              const text = btn.textContent?.toLowerCase() || btn.value?.toLowerCase() || '';
              if (text.includes('pay') || text.includes('place order') || text.includes('complete') || text.includes('submit')) {
                if (!btn.disabled && btn.offsetParent !== null) {
                  btn.click();
                  return { success: true, text: btn.textContent || btn.value };
                }
              }
            }
            
            // Try specific selectors
            for (const selector of selectors) {
              const el = document.querySelector(selector);
              if (el && !el.disabled && el.offsetParent !== null) {
                el.click();
                return { success: true, text: el.textContent || el.value };
              }
            }
            
            return { success: false };
          })()
        `,
                returnByValue: true,
            });
            if (result.result.value.success) {
                return { success: true };
            }
            return { success: false, error: 'Could not find pay/submit button' };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    async verifyPaymentSuccess(cdpController) {
        // Wait for potential redirect or confirmation
        await this.delay(3000);
        // Use Claude Vision to analyze the result page
        const screenshot = await cdpController.send('Page.captureScreenshot', { format: 'png' });
        const response = await this.client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: { type: 'base64', media_type: 'image/png', data: screenshot.data },
                        },
                        {
                            type: 'text',
                            text: `Analyze this page to determine if a payment was successful.
            
Look for:
1. Success indicators (green checkmark, "Thank you", "Order confirmed", etc.)
2. Error indicators (red text, "Payment failed", "Card declined", etc.)
3. Confirmation/order number if visible

Return JSON:
{
  "success": true/false,
  "confirmationNumber": "..." or null,
  "message": "summary of what the page shows"
}`,
                        },
                    ],
                }],
        });
        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            return jsonMatch ? JSON.parse(jsonMatch[0]) : { success: false, message: 'Could not determine payment status' };
        }
        catch {
            return { success: false, message: 'Could not parse payment status' };
        }
    }
    async selectPaymentMethod(cdpController, method) {
        const methodSelectors = {
            card: [
                '[data-testid="card-payment"]',
                'input[value="card"]',
                'label:contains("Credit Card")',
                'label:contains("Debit Card")',
                '.payment-method-card',
            ],
            paypal: [
                '[data-testid="paypal"]',
                'input[value="paypal"]',
                'label:contains("PayPal")',
                '.paypal-button',
            ],
            apple_pay: [
                '[data-testid="apple-pay"]',
                '.apple-pay-button',
                'button:contains("Apple Pay")',
            ],
            google_pay: [
                '[data-testid="google-pay"]',
                '.gpay-button',
                'button:contains("Google Pay")',
            ],
        };
        const selectors = methodSelectors[method] || [];
        const result = await cdpController.send('Runtime.evaluate', {
            expression: `
        (function() {
          const selectors = ${JSON.stringify(selectors)};
          for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el && el.offsetParent !== null) {
              el.click();
              return true;
            }
          }
          return false;
        })()
      `,
            returnByValue: true,
        });
        if (result.result.value) {
            await this.delay(1000);
            return { success: true };
        }
        return { success: false, error: `Could not find ${method} payment option` };
    }
    async fillPaymentField(cdpController, selectors, value) {
        for (const selector of selectors) {
            const result = await cdpController.send('Runtime.evaluate', {
                expression: `
          (function() {
            const el = document.querySelector('${selector}');
            if (el && el.offsetParent !== null) {
              el.focus();
              el.value = '';
              return true;
            }
            return false;
          })()
        `,
                returnByValue: true,
            });
            if (result.result.value) {
                // Type character by character for security fields
                for (const char of value) {
                    await cdpController.send('Input.dispatchKeyEvent', {
                        type: 'keyDown',
                        text: char,
                    });
                    await cdpController.send('Input.dispatchKeyEvent', {
                        type: 'keyUp',
                        text: char,
                    });
                    await this.delay(50 + Math.random() * 50);
                }
                // Trigger change event
                await cdpController.send('Runtime.evaluate', {
                    expression: `
            (function() {
              const el = document.querySelector('${selector}');
              if (el) {
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('blur', { bubbles: true }));
              }
            })()
          `,
                });
                return true;
            }
        }
        return false;
    }
    async checkFieldExists(cdpController, selectors) {
        for (const selector of selectors) {
            const result = await cdpController.send('Runtime.evaluate', {
                expression: `!!document.querySelector('${selector}')`,
                returnByValue: true,
            });
            if (result.result.value)
                return true;
        }
        return false;
    }
    delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
}
exports.ThePaymentHandler = ThePaymentHandler;
__decorate([
    (0, event_bus_1.traced)('payment_handler'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ThePaymentHandler.prototype, "detectPaymentForm", null);
__decorate([
    (0, event_bus_1.traced)('payment_handler'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ThePaymentHandler.prototype, "fillPaymentForm", null);
__decorate([
    (0, event_bus_1.traced)('payment_handler'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ThePaymentHandler.prototype, "clickPayButton", null);
__decorate([
    (0, event_bus_1.traced)('payment_handler'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ThePaymentHandler.prototype, "verifyPaymentSuccess", null);
__decorate([
    (0, event_bus_1.traced)('payment_handler'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ThePaymentHandler.prototype, "selectPaymentMethod", null);
/**
 * Create all extended specialist agents
 * These require CDP controller injection via setCDPController()
 */
function createExtendedSpecialists() {
    return {
        ecommerceExpert: new TheEcommerceExpert(),
        dataExtractor: new TheDataExtractor(),
        researchAgent: new TheResearchAgent(),
        bookingAgent: new TheBookingAgent(),
        paymentHandler: new ThePaymentHandler(),
    };
}
exports.createExtendedSpecialists = createExtendedSpecialists;
// =============================================================================
// EXPORTS
// =============================================================================
// Singleton instances (for backward compatibility)
exports.ecommerceExpert = new TheEcommerceExpert();
exports.dataExtractor = new TheDataExtractor();
exports.researchAgent = new TheResearchAgent();
exports.bookingAgent = new TheBookingAgent();
exports.paymentHandler = new ThePaymentHandler();
