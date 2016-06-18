import 'babel-polyfill';
import jsonpointer from 'jsonpointer';

const BAD_OPEN_PATTERN = new RegExp('\\{{3,}');
const BAD_CLOSE_PATTERN = new RegExp('\\}{3,}');
const GROUP_PATTERN = new RegExp('{{([^{^}]*)}}');
const OPEN_PATTERN = new RegExp('{{');
const CLOSE_PATTERN = new RegExp('}}');

/**
 * Returns key, value, parent triplets for all nested string values.
 *
 * @param {Object|Array} obj The object to generate values for.
 * @returns {Generator} A generator object to iterate over.
 */
export function* stringValueGenerator(obj) {

    if (Array.isArray(obj)) {
        for (let index = 0; index < obj.length; index++) {
            const value = obj[index];
            if (typeof value === 'string') {
                yield [index, value, obj];
            }
            if (typeof value === 'object') {
                yield* stringValueGenerator(value);
            }
        }
    } else if (typeof obj === 'object') {
        const keys = Object.keys(obj);
        for (let index = 0; index < keys.length; index++) {
            const key = keys[index];
            const value = obj[key];
            if (typeof value === 'string') {
                yield [key, value, obj];
            }
            if (typeof value === 'object') {
                yield* stringValueGenerator(value);
            }
        }
    }

}

/**
 * Search string for embedded json pointers and return information on them.
 *
 * @param {String} string A value from the document that may have refs.
 * @returns {Object[]} Each has the form {pointer: {String}, indices: {Array}}.
 */
export function getReferences(string) {

    if (BAD_OPEN_PATTERN.test(string)) {
        throw new Error(`Syntax Error in ${string}.`)
    }
    if (BAD_CLOSE_PATTERN.test(string)) {
        throw new Error(`Syntax Error in ${string}.`)
    }

    const references = [];
    let searchIndex = 0;
    while (true) {
        const subString = string.slice(searchIndex);
        const test = GROUP_PATTERN.test(subString);
        if (!test) {
            if (OPEN_PATTERN.test(subString) || CLOSE_PATTERN.test(subString)) {
                throw new Error(`Syntax Error in ${string}.`);
            }
            break;
        }
        const search = subString.search(GROUP_PATTERN);
        const match = subString.match(GROUP_PATTERN);
        const start = searchIndex + search;
        const end = searchIndex + search + match[0].length;
        searchIndex = end;
        references.push({pointer: match[1], indices: [start, end]});
    }

    return references;

}

/**
 * Resolve a string value using the given document as context.
 *
 * @param {String} string The string to resolve pointers inside of.
 * @param {Object|Array} document A loaded json document.
 * @param {Number} maxRecursion Prevents cyclic references. Increase if needed.
 * @returns {String} The resolved string.
 */
export function resolveString(string, document, maxRecursion = 100) {

    let recursions = 0;
    while (true) {
        if (recursions > maxRecursion) {
            throw new Error('Max Recursion');
        }
        recursions += 1;
        const references = getReferences(string);
        if (!references.length) {
            break;
        }

        let offset = 0;
        for (let i = 0; i < references.length; i++) {
            const {pointer, indices} = references[i];
            const [start, stop] = indices;
            const value = jsonpointer.get(document, pointer);
            if (typeof value !== 'string') {
                throw new Error('Variables must be strings.');
            }
            string = string.slice(0, offset + start) + value +
                     string.slice(offset + stop);
            offset += value.length - (stop - start);
        }
    }

    return string;

}

/**
 * Set pointers to equal their resolved values inside a loaded json document.
 *
 * @param {Object|Array} document A loaded json document.
 * @param {Boolean} inplace If false, set values in a *copy* of the document.
 * @param {Number} maxRecursion Prevents cyclic references. Increase if needed.
 * @returns {Object|Array} A dereferenced document (may be a copy).
 */
export default function dereference(document, inplace = true,
                                    maxRecursion = 100) {
    if (!inplace) {
        document = JSON.parse(JSON.stringify(document));
    }
    for (let item of stringValueGenerator(document)) {
        const [key, value, parent] = item;
        parent[key] = resolveString(value, document, maxRecursion);
    }
    return document;
}
