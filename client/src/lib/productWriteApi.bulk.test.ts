import { beforeEach, describe, expect, it, vi } from "vitest";

type Filter = [kind: "in" | "eq", column: string, value: unknown];
type Call = { table: string; op: "select" | "delete" | "update"; values?: Record<string, unknown>; filters: Filter[] };
type Result = { data?: unknown; error?: { code?: string; message?: string } | null };

let rules: (call: Call) => Result;
let calls: Call[];
let removedFiles: string[][];
let removeFails = false;

/** A pretend Supabase client that records what was asked and answers from `rules`. */
const fakeClient = {
  from(table: string) {
    const call: Call = { table, op: "select", filters: [] };
    const api = {
      select: () => api,
      delete: () => ((call.op = "delete"), api),
      update: (values: Record<string, unknown>) => ((call.op = "update"), (call.values = values), api),
      in: (column: string, value: unknown[]) => (call.filters.push(["in", column, value]), api),
      eq: (column: string, value: unknown) => (call.filters.push(["eq", column, value]), api),
      then: (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) => {
        calls.push({ ...call, filters: [...call.filters] });
        return Promise.resolve(rules(call)).then(value => ({ data: null, error: null, ...value }), reject).then(resolve, reject);
      },
    };
    return api;
  },
  storage: {
    from: () => ({
      remove: async (paths: string[]) => {
        removedFiles.push(paths);
        if (removeFails) throw new Error("storage is down");
        return { data: [], error: null };
      },
    }),
  },
};

vi.mock("@/lib/supabase", () => ({ getSupabaseClient: () => fakeClient }));

const { deleteProductsBulk, setProductsActive, setProductsCategory } = await import("./productWriteApi");

const FK = { code: "23503", message: 'update or delete on table "products" violates foreign key constraint "quote_request_items_product_id_fkey"' };
const idsOf = (call: Call) => (call.filters.find(filter => filter[0] === "in")?.[2] as string[]) ?? [];
const files = (productIds: string[]) => productIds.map(id => ({ product_id: id, storage_path: `products/${id}/photo.jpg` }));

beforeEach(() => {
  calls = [];
  removedFiles = [];
  removeFails = false;
  rules = () => ({});
});

describe("deleteProductsBulk", () => {
  it("deletes the products in one request and removes their photos", async () => {
    rules = call => (call.table === "product_images" ? { data: files(["a", "b", "c"]) } : {});
    const result = await deleteProductsBulk(["a", "b", "c"]);
    expect(result).toEqual({ deleted: 3, blocked: 0 });
    expect(calls.filter(call => call.op === "delete")).toHaveLength(1);
    expect(removedFiles.flat().sort()).toEqual(["products/a/photo.jpg", "products/b/photo.jpg", "products/c/photo.jpg"]);
  });

  it("skips a product that is part of a quote request and still deletes the rest", async () => {
    rules = call => {
      if (call.table === "product_images") return { data: files(["a", "b", "c"]) };
      const single = call.filters.find(filter => filter[0] === "eq");
      if (call.op === "delete" && !single) return { error: FK };
      if (call.op === "delete" && single?.[2] === "b") return { error: FK };
      return {};
    };
    const result = await deleteProductsBulk(["a", "b", "c"]);
    expect(result).toEqual({ deleted: 2, blocked: 1 });
    // The blocked product keeps its photos.
    expect(removedFiles.flat().sort()).toEqual(["products/a/photo.jpg", "products/c/photo.jpg"]);
  });

  it("reports everything as blocked when every product is in a quote request", async () => {
    rules = call => (call.op === "delete" ? { error: FK } : { data: [] });
    expect(await deleteProductsBulk(["a", "b"])).toEqual({ deleted: 0, blocked: 2 });
    expect(removedFiles).toEqual([]);
  });

  it("stops and reports any other database error", async () => {
    rules = call => (call.op === "delete" ? { error: { code: "42501", message: "permission denied" } } : { data: [] });
    await expect(deleteProductsBulk(["a"])).rejects.toMatchObject({ code: "42501" });
  });

  it("works through a long list a few at a time", async () => {
    const ids = Array.from({ length: 45 }, (_, index) => `p${index}`);
    rules = () => ({ data: [] });
    const result = await deleteProductsBulk(ids);
    expect(result.deleted).toBe(45);
    const deletes = calls.filter(call => call.op === "delete");
    expect(deletes.map(call => idsOf(call).length)).toEqual([20, 20, 5]);
  });

  it("still reports the products as deleted when the photo files cannot be removed", async () => {
    removeFails = true;
    rules = call => (call.table === "product_images" ? { data: files(["a"]) } : {});
    await expect(deleteProductsBulk(["a"])).resolves.toEqual({ deleted: 1, blocked: 0 });
  });
});

describe("bulk updates", () => {
  it("sets visibility for every id, 50 at a time", async () => {
    const ids = Array.from({ length: 120 }, (_, index) => `p${index}`);
    await setProductsActive(ids, true);
    const updates = calls.filter(call => call.op === "update");
    expect(updates.map(call => idsOf(call).length)).toEqual([50, 50, 20]);
    expect(updates.every(call => call.values?.is_active === true)).toBe(true);
  });

  it("sets one category for every id", async () => {
    await setProductsCategory(["a", "b"], "Fashion accessories");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ table: "products", op: "update", values: { category: "Fashion accessories" } });
    expect(idsOf(calls[0])).toEqual(["a", "b"]);
  });

  it("throws the database error so the screen can tell the person", async () => {
    rules = () => ({ error: { code: "42501", message: "permission denied for table products" } });
    await expect(setProductsActive(["a"], false)).rejects.toMatchObject({ message: "permission denied for table products" });
  });
});
