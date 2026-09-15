/**
 * Document Template Rendering Engine
 * Implements:
 * - Central variable interpolation ({{var}} and {{{unescaped}}})
 * - Repeating blocks ({{#arrayName}}...{{/arrayName}})
 * - Conditional blocks ({{#if condition}}...{{else}}...{{/if}})
 * - Mandatory System Watermark Injection (Blueprint Section 32)
 */

export interface RenderOptions {
  watermarkText?: string;
  forceWatermark?: boolean; // defaults to true
}

export function renderDocumentTemplate(
  templateContent: string,
  contextData: Record<string, any>,
  options: RenderOptions = {}
): string {
  let output = templateContent;

  // 1. Process Conditional Blocks: {{#if key}} ... ({{else}} ...)? {{/if}}
  const ifRegex = /\{\{#if\s+([a-zA-Z0-9_.]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;
  output = output.replace(ifRegex, (_match, key, truthyContent, falsyContent = '') => {
    const val = getNestedValue(contextData, key.trim());
    const isTruthy = Boolean(val && (Array.isArray(val) ? val.length > 0 : true));
    return isTruthy ? truthyContent : falsyContent;
  });

  // 2. Process Repeating / Loop Blocks: {{#key}} ... {{/key}}
  const loopRegex = /\{\{#([a-zA-Z0-9_.]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
  output = output.replace(loopRegex, (_match, key, innerContent) => {
    const list = getNestedValue(contextData, key.trim());
    if (!Array.isArray(list) || list.length === 0) {
      return '';
    }

    return list
      .map((item, index) => {
        let itemRender = innerContent;

        // Loop index variables
        itemRender = itemRender.replace(/\{\{@index\}\}/g, String(index));
        itemRender = itemRender.replace(/\{\{@number\}\}/g, String(index + 1));

        // Object properties in item
        if (typeof item === 'object' && item !== null) {
          for (const [prop, val] of Object.entries(item)) {
            const valStr = val !== undefined && val !== null ? String(val) : '';
            // Substituted with both simple prop and key.prop
            const r1 = new RegExp(`\\{\\{\\{\\s*${prop}\\s*\\}\\}\\}`, 'g');
            const r2 = new RegExp(`\\{\\{\\s*${prop}\\s*\\}\\}`, 'g');
            const r3 = new RegExp(`\\{\\{\\{\\s*${key}\\.${prop}\\s*\\}\\}\\}`, 'g');
            const r4 = new RegExp(`\\{\\{\\s*${key}\\.${prop}\\s*\\}\\}`, 'g');

            itemRender = itemRender
              .replace(r1, valStr)
              .replace(r2, valStr)
              .replace(r3, valStr)
              .replace(r4, valStr);
          }
        } else {
          // Primitive item in array
          const valStr = String(item);
          itemRender = itemRender.replace(/\{\{this\}\}/g, valStr);
        }

        return itemRender;
      })
      .join('');
  });

  // 3. Process Variables (Flatten contextData keys & nested paths)
  const flattened = flattenData(contextData);

  // Replace unescaped {{{variable}}}
  for (const [k, v] of Object.entries(flattened)) {
    const regex = new RegExp(`\\{\\{\\{\\s*${escapeRegExp(k)}\\s*\\}\\}\\}`, 'g');
    output = output.replace(regex, v !== undefined && v !== null ? String(v) : '');
  }

  // Replace standard {{variable}}
  for (const [k, v] of Object.entries(flattened)) {
    const regex = new RegExp(`\\{\\{\\s*${escapeRegExp(k)}\\s*\\}\\}`, 'g');
    output = output.replace(regex, v !== undefined && v !== null ? String(v) : '');
  }

  // 4. Inject Mandatory System Watermark Layer (Blueprint Section 32)
  const shouldWatermark = options.forceWatermark !== false;
  if (shouldWatermark) {
    const text =
      options.watermarkText ||
      'Powered by Biddyapith • Official Institutional Document';

    const watermarkHtml = `<div class="biddyapith-footer-watermark" style="margin-top: 2rem; padding-top: 0.75rem; border-top: 1px solid #e2e8f0; text-align: center; font-size: 0.72rem; color: #94a3b8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; letter-spacing: 0.06em; text-transform: uppercase;">${text}</div>`;

    if (!output.includes('biddyapith-footer-watermark')) {
      output = `${output}\n${watermarkHtml}`;
    }
  }

  return output;
}

/**
 * Retrieve value from object by dot-notation path
 */
function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  if (path in obj) return obj[path];

  const parts = path.split('.');
  let curr = obj;
  for (const part of parts) {
    if (curr === undefined || curr === null) return undefined;
    curr = curr[part];
  }
  return curr;
}

/**
 * Flatten nested objects into dot-notated key-value dictionary
 */
function flattenData(data: Record<string, any>, prefix = ''): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    result[fullKey] = value;

    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      Object.assign(result, flattenData(value, fullKey));
    }
  }

  return result;
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

