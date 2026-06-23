import { buildE5Input } from "./embeddingService";

describe("buildE5Input", () => {
  it("prefixes passages by default", () => {
    expect(buildE5Input("isi pasal 5")).toBe("passage: isi pasal 5");
  });
  it("prefixes queries when kind=query", () => {
    expect(buildE5Input("isi pasal 5", "query")).toBe("query: isi pasal 5");
  });
  it("does not double-prefix", () => {
    expect(buildE5Input("query: x", "query")).toBe("query: x");
  });
});
