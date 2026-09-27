import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { idSchema, type PhotoDTO } from '@supplysync/shared';
import { requireMembership } from '../../lib/access';
import { AppError, Errors } from '../../lib/errors';
import { parse } from '../../lib/validate';
import { sniffImage } from '../../services/storage';

const photoParams = z.object({ householdId: idSchema, photoId: idSchema });

export async function photoRoutes(app: FastifyInstance) {
  const { prisma, storage } = app.services;

  app.post('/', { config: { rateLimit: { max: 30, timeWindow: '1 hour' } } }, async (request, reply) => {
    const { householdId } = await requireMembership(request);
    if (!request.isMultipart()) throw new AppError(415, 'UNSUPPORTED', 'Envie a foto como multipart/form-data');

    const file = await request.file();
    if (!file) throw Errors.badRequest('Nenhuma foto enviada');

    let buffer: Buffer;
    try {
      buffer = await file.toBuffer(); // respeita o limite de tamanho configurado
    } catch {
      throw new AppError(413, 'TOO_LARGE', 'A foto precisa ter até 5 MB');
    }

    // O tipo é definido pelos bytes do arquivo, nunca pelo nome ou Content-Type enviados.
    const kind = sniffImage(buffer);
    if (!kind) throw new AppError(415, 'UNSUPPORTED', 'Use uma foto JPG, PNG, WEBP ou HEIC');

    const id = randomUUID();
    const storageKey = `${id}.${kind.ext}`;
    await storage.put(storageKey, buffer);
    await prisma.photo.create({
      data: { id, householdId, uploadedById: request.userId, storageKey, mimeType: kind.mime, sizeBytes: buffer.length },
    });

    const dto: PhotoDTO = { id };
    return reply.status(201).send(dto);
  });

  app.get('/:photoId', async (request, reply) => {
    const { householdId } = await requireMembership(request);
    const { photoId } = parse(photoParams, request.params);
    const photo = await prisma.photo.findFirst({ where: { id: photoId, householdId } });
    if (!photo) throw Errors.notFound();

    return reply
      .header('Content-Type', photo.mimeType)
      .header('Content-Disposition', 'inline')
      .header('Cache-Control', 'private, max-age=3600')
      .send(storage.get(photo.storageKey));
  });
}
