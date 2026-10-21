# Ingredient guide

Hover over (or tap) an ingredient name in the admin to see UK catering guidance: typical shelf life (fridge, freezer, cupboard, once opened), storage, the 14 UK allergens, cooking temperatures, handling and catering notes.

- Data: `lib/ingredient-reference-data.ts` (one entry per ingredient).
- Matching and the UK 14 allergens: `lib/ingredient-reference.ts`. A name matches an entry by its `name` or any of its `aliases`; plurals match automatically and the longest match wins, so "Chicken stock" finds stock rather than chicken.
- Card: `components/ingredient-info.tsx`. In the admin use `<IngredientName id={ingredientId} />` from `app/admin/ingredient-name.tsx`.
- Ingredients with no entry show general guidance for their category and say so.
- If an ingredient's own allergen field misses an allergen the guide says it always contains, the card warns.

## Adding an ingredient

1. Copy a similar entry in `lib/ingredient-reference-data.ts` and give it a unique `id`.
2. List the names it is sold under in `aliases`, in lower case.
3. Put allergens it always contains in `allergens`, and ones that depend on the brand in `checkLabel`.
4. Run `npm test`; the tests check ids, allergen names and that every sample ingredient has a guide.

Shelf lives are typical guide times for product stored at 0–5°C or −18°C. The pack's use-by date and the business's food safety plan always take priority. Sources: FSA Safer Food, Better Business, FSA allergen guidance and FSA cooking guidance.
