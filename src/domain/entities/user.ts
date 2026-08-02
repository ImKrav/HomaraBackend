export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly password?: string,
    public readonly firstName?: string,
    public readonly lastName?: string,
    public readonly phone?: string | null,
    public readonly address?: string | null,
    public readonly city?: string | null,
    public readonly state?: string | null,
    public readonly zipCode?: string | null,
    public readonly role?: "CUSTOMER" | "ADMIN",
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date
  ) {}
}
