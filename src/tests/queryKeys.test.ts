import { describe, it, expect } from 'vitest';
import { queryKeys } from '@/lib/queryKeys';

describe('queryKeys factory', () => {
  describe('household', () => {
    it('mine() returns stable key array', () => {
      expect(queryKeys.household.mine()).toEqual(['households', 'mine']);
    });

    it('pending() returns stable key array', () => {
      expect(queryKeys.household.pending()).toEqual(['households', 'pending']);
    });

    it('members(id) includes the household id', () => {
      const id = 'abc-123';
      expect(queryKeys.household.members(id)).toEqual(['households', id, 'members']);
    });
  });

  describe('users', () => {
    it('me() returns stable key', () => {
      expect(queryKeys.users.me()).toEqual(['users', 'me']);
    });

    it('search(handle) includes handle', () => {
      expect(queryKeys.users.search('alice')).toEqual(['users', 'search', 'alice']);
    });

    it('profile(handle) includes handle', () => {
      expect(queryKeys.users.profile('alice')).toEqual(['users', 'profile', 'alice']);
    });
  });

  describe('recipeBook', () => {
    it('recipes() with no args uses empty strings for optional params', () => {
      expect(queryKeys.recipeBook.recipes()).toEqual(['recipe-book', 'recipes', '', '']);
    });

    it('recipes(search) includes search term', () => {
      expect(queryKeys.recipeBook.recipes('chocolate')).toEqual(['recipe-book', 'recipes', 'chocolate', '']);
    });

    it('recipes(search, categoryId) includes both', () => {
      expect(queryKeys.recipeBook.recipes('cake', 'cat-uuid')).toEqual(['recipe-book', 'recipes', 'cake', 'cat-uuid']);
    });

    it('recipe(id) includes id', () => {
      expect(queryKeys.recipeBook.recipe('r-123')).toEqual(['recipe-book', 'recipes', 'r-123']);
    });

    it('pins() returns stable key', () => {
      expect(queryKeys.recipeBook.pins()).toEqual(['recipe-book', 'pins']);
    });

    it('canMake() returns stable key', () => {
      expect(queryKeys.recipeBook.canMake()).toEqual(['recipe-book', 'can-make']);
    });
  });

  describe('pantry', () => {
    it('categories() returns stable key', () => {
      expect(queryKeys.pantry.categories()).toEqual(['pantry', 'categories']);
    });

    it('items() with no categoryId uses empty string', () => {
      expect(queryKeys.pantry.items()).toEqual(['pantry', 'items', '']);
    });

    it('items(categoryId) includes categoryId', () => {
      expect(queryKeys.pantry.items('cat-uuid')).toEqual(['pantry', 'items', 'cat-uuid']);
    });

    it('item(id) includes id', () => {
      expect(queryKeys.pantry.item('item-uuid')).toEqual(['pantry', 'items', 'item-uuid']);
    });
  });

  describe('shoppingList', () => {
    it('categories() returns stable key', () => {
      expect(queryKeys.shoppingList.categories()).toEqual(['shopping-list', 'categories']);
    });

    it('items() returns stable key', () => {
      expect(queryKeys.shoppingList.items()).toEqual(['shopping-list', 'items']);
    });
  });

  describe('shares', () => {
    it('received() returns stable key', () => {
      expect(queryKeys.shares.received()).toEqual(['shares', 'received']);
    });

    it('sent() returns stable key', () => {
      expect(queryKeys.shares.sent()).toEqual(['shares', 'sent']);
    });

    it('review(shareId) includes shareId', () => {
      expect(queryKeys.shares.review('s-123')).toEqual(['shares', 's-123', 'review']);
    });
  });

  describe('follows', () => {
    it('following() returns stable key', () => {
      expect(queryKeys.follows.following()).toEqual(['follows', 'following']);
    });

    it('followers() returns stable key', () => {
      expect(queryKeys.follows.followers()).toEqual(['follows', 'followers']);
    });
  });

  describe('key uniqueness', () => {
    it('different resources produce different keys', () => {
      const keys = [
        queryKeys.household.mine(),
        queryKeys.users.me(),
        queryKeys.recipeBook.recipes(),
        queryKeys.pantry.items(),
        queryKeys.shoppingList.items(),
        queryKeys.shares.received(),
      ];
      const serialised = keys.map(JSON.stringify);
      const unique = new Set(serialised);
      expect(unique.size).toBe(keys.length);
    });
  });
});
