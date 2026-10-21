import test from "node:test";
import assert from "node:assert/strict";
import {
  findIngredientReference,
  ingredientReferenceData,
  ingredientReferenceFor,
  parseAllergens,
  ukAllergens,
} from "../lib/ingredient-reference";
import { sampleState } from "../lib/sample";

test("reference entries have unique ids and valid UK allergens", () => {
  const ids = new Set<string>();
  for (const entry of ingredientReferenceData) {
    assert.ok(!ids.has(entry.id), `duplicate id ${entry.id}`);
    ids.add(entry.id);
    for (const allergen of [...entry.allergens, ...(entry.checkLabel || [])])
      assert.ok(ukAllergens.includes(allergen), `${entry.id}: unknown allergen ${allergen}`);
    assert.ok(entry.storage && entry.handling.length, `${entry.id}: storage and handling are required`);
    for (const alias of entry.aliases) assert.equal(alias, alias.toLowerCase(), `${entry.id}: alias "${alias}" should be lower case`);
  }
});

test("every sample catalogue ingredient has a specific guide", () => {
  for (const ingredient of sampleState().ingredients)
    assert.ok(findIngredientReference(ingredient.name), `no guide for ${ingredient.name}`);
});

test("the most specific name wins", () => {
  const cases: [string, string][] = [
    ["Beef mince (20% fat)", "beef-mince"],
    ["Burger buns (seeded)", "burger-buns"],
    ["Chicken stock", "stock"],
    ["Chicken thighs", "chicken-thigh"],
    ["Sour cream", "sour-cream"],
    ["Peanut butter", "peanuts"],
    ["Red wine vinegar", "vinegar"],
    ["Onions (red)", "onion"],
    ["Cornflour", "flour"],
    ["Crème fraîche", "sour-cream"],
    ["Tomatoes", "tomatoes"],
    ["Tomato ketchup", "ketchup"],
  ];
  for (const [name, id] of cases) assert.equal(findIngredientReference(name)?.id, id, name);
});

test("unknown ingredients fall back to category guidance", () => {
  const { reference, generic } = ingredientReferenceFor("Ostrich fillet", "meat");
  assert.equal(generic, true);
  assert.equal(reference.category, "meat");
  assert.equal(reference.highRisk, true);
});

test("free-text allergens map to the UK 14", () => {
  assert.deepEqual(parseAllergens("Wheat, milk, egg, sesame").sort(), ["cereals containing gluten", "eggs", "milk", "sesame"]);
  assert.deepEqual(parseAllergens("Celery"), ["celery"]);
  assert.deepEqual(parseAllergens(""), []);
  assert.deepEqual(parseAllergens("peanuts"), ["peanuts"]);
});
