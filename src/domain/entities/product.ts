export class ProductTag {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly productId: string
  ) {}
}

export class Product {
  public readonly reviews?: number;

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
    public readonly price: number,
    public readonly originalPrice: number | null,
    public readonly image: string,
    public readonly rating: number,
    public readonly reviewCount: number,
    public readonly inStock: boolean,
    public readonly stockQuantity: number,
    public readonly unit: string,
    public readonly categoryId: string,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date,
    public readonly tags?: string[],
    public readonly category?: string,
    public readonly categorySlug?: string
  ) {
    this.reviews = reviewCount;
  }
}

