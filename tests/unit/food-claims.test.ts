import { describe, expect, it } from 'vitest'
import { postProcessFood } from '@/lib/ai/features/food'

const dish = (name: string, notes = '', tags: string[] = []) => ({ name, category: 'snack', quantity: 1, unit: 'bowl', estimated_cost: 5, dietary_tags: tags, notes })

describe('food: no allergen-safety promises, and the text stays readable', () => {
  it('dish names and tags become labelled options; blanket safety promises are removed; the text stays readable', () => {
    const out = postProcessFood({
      items: [dish('Gluten-free cheese pizza', 'Check with the gluten-free child’s family.', ['gluten-free']), dish('Nut-free trail mix', 'This is safe for everyone. Allergen-free cake.'), dish('Gluten-free')],
      shoppingList: [{ item: 'Gluten-free crackers', qty: '2', category: 'food', estimatedCost: 9 }],
      prepTimeline: [{ when: 'Morning of', task: 'Keep the allergy-safe plate separate' }],
      tips: ['Label dishes so families can check ingredients.'],
    } as never)
    expect(out.items.map((d) => d.name)).toEqual(['Cheese pizza (gluten-free option)', 'Trail mix (nut-free option)', 'Menu item (gluten-free option)'])
    expect(out.items[0].notes).toBe('Check with the gluten-free child’s family.') // dietary words keep the advice meaningful
    expect(out.items[1].notes).toBe('This is allergy-aware. allergy-aware cake.')
    expect(out.items[0].dietary_tags).toEqual(['gluten-free option'])
    expect(out.shoppingList[0].item).toBe('Gluten-free crackers')
    expect(out.prepTimeline[0].task).toBe('Keep the allergy-aware plate separate')
    expect(JSON.stringify({ ...out, allergyNote: '' })).not.toMatch(/check-with-families|safe for|allergy[- ]safe/i)
    expect(out.allergyNote).toMatch(/check allergies/i)
  })
})
