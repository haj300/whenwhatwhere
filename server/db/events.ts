import { PrismaClient } from "@prisma/client";
import type { event } from "@prisma/client";
import type { NewEvent } from "../domain/types";

export const prisma = new PrismaClient();

export async function listEvents(): Promise<event[]> {
  return prisma.event.findMany();
}

export async function getEventById(id: number): Promise<event | null> {
  return prisma.event.findUnique({ where: { id } });
}

export async function createEvent(
  data: NewEvent,
  createdById: number,
): Promise<event> {
  return prisma.event.create({
    data: {
      name: data.name,
      description: data.description,
      date: data.date,
      location: data.location,
      link: data.link ?? null,
      image: data.image ?? null,
      createdById: createdById,
    },
  });
}

export async function updateEvent(id: number, data: NewEvent): Promise<event> {
  return prisma.event.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      date: data.date,
      location: data.location,
      link: data.link ?? null,
      ...(data.image !== undefined ? { image: data.image } : {}),
    },
  });
}

export async function deleteEvent(id: number): Promise<void> {
  await prisma.event.delete({ where: { id } });
}
