export class Review {
  constructor(
    public readonly id: string,
    public readonly rating: number,
    public readonly comment: string | null,
    public readonly createdAt: Date,
    public readonly userId: string,
    public readonly productId: string,
    public readonly userFirstName?: string,
    public readonly userLastName?: string
  ) {}
}
