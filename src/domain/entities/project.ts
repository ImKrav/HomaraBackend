export class ProjectMaterial {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly quantity: string,
    public readonly note: string | null,
    public readonly icon: string,
    public readonly price: number,
    public readonly projectId: string,
    public readonly productId?: string | null
  ) {}
}

export class Project {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly type: "PISO" | "PARED" | "TECHO" | "INTEGRAL",
    public readonly status: "EN_PROGRESO" | "COMPLETADO" | "PAUSADO",
    public readonly length: number | null,
    public readonly width: number | null,
    public readonly height: number | null,
    public readonly area: number,
    public readonly materialType: string | null,
    public readonly tileFormat: string | null,
    public readonly thumbnail: string,
    public readonly estimatedCost: number,
    public readonly userId: string,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date,
    public readonly materials?: ProjectMaterial[]
  ) {}
}
