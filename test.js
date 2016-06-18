import expect from 'expect';

import dereference, {
    stringValueGenerator,
    resolveString,
    getReferences
} from './index';

describe('stringValueGenerator', () => {

    it('generates (key, value, parent) triplet for all strings', () => {

        const object1 = {g: '6'};
        const array1 = ['5', object1];
        const object2 = {f: array1};
        const object3 = {e: object2};
        const object4 = {c: '4'};
        const array2 = ['2', '3', object4];
        const document = {a: '1', b: array2, 'd': object3};

        const expectedItems = [
            ['a', '1', document],
            [0, '2', array2],
            [1, '3', array2],
            ['c', '4', object4],
            [0, '5', array1],
            ['g', '6', object1]
        ];

        const generator = stringValueGenerator(document);
        const items = [...generator];
        expect(items).toEqual(expectedItems);

    });

});

describe('getReferences', () => {

    it('throws for unbalanced groupings', () => {

        const strings = ['{{foo', 'foo}}', '{{{bar}}', '{{bar}}}'];
        for (let string of strings) {
            const errorMessage = `Syntax Error in ${string}`;
            expect(() => getReferences(string)).toThrow(errorMessage);
        }

    });

    it('returns references list', () => {

        const string = "This references {{/one}}, {{/two}}, and {{/three}}!";
        const expectedReferences = [
            {indices: [16, 24], pointer: '/one'},
            {indices: [26, 34], pointer: '/two'},
            {indices: [40, 50], pointer: '/three'}
        ];
        const references = getReferences(string);
        expect(references).toEqual(expectedReferences);

    });

});

describe('resolveString', () => {

    it('catches cyclic references', () => {

        const document = {
            a: 'I point to {{/b}}.',
            b: 'And "/b" points to {{/c}}.',
            c: 'But "/c" points {{/a}}!'
        };

        Object.keys(document).forEach(key => {
            expect(() => resolveString(document[key], document))
                .toThrow('Max Recursion');
        });

    });

    it('allows you to increase maxRecursion', () => {

        const document = {
            a: 'I point to {{/b}}.',
            b: 'And "/b" points to {{/c}}.',
            c: '\o/'
        };

        // We need two recursions, but we're limited to one --> error.
        expect(() => resolveString(document.a, document, 1))
            .toThrow('Max Recursion');

        // We have a built-in workaround though...
        resolveString(document.a, document, 2)

    });

    it('resolves as expected', () => {

        const document = {
            a: 'A {{/b/0/a}} value and a {{/c}} value.',
            b: [{a: 'nested'}],
            c: 'top-level'
        };

        const resolvedString = resolveString(document.a, document);
        const expectedResolvedString = 'A nested value and a top-level value.';
        expect(resolvedString).toEqual(expectedResolvedString);

    });

    it('does not allow non-string references yet', () => {

        expect(() => resolveString('{{/a}}', {a: 5}))
            .toThrow('Variables must be strings.')

    });

});

describe('dereference', () => {

    let document;
    let dereferenced_document;

    beforeEach(() => {

        document = {
            a: 'beep {{/b}}',
            b: 'boop',
            c: [{a: '{{/a}}', b: '{{/b}}'}, {a: 'foo', b: 'bar'}],
            e: '{{/c/0/b}} and {{/c/1/b}}',
            f: ['{{/b}}']
        };

        dereferenced_document = {
            a: 'beep boop',
            c: [{a: 'beep boop', b: 'boop'}, {a: 'foo', b: 'bar'}],
            b: 'boop',
            e: 'boop and bar',
            f: ['boop']
        }

    });

    it('defaults to de-referencing the document *inplace*', () => {

        dereference(document);
        expect(document).toEqual(dereferenced_document);

    });

    it('uses a copy if inplace=false', () => {

        const result = dereference(document, false);
        expect(document).toNotEqual(dereferenced_document);
        expect(result).toEqual(dereferenced_document);

    });

});
