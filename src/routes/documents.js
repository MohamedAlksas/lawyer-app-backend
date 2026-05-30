import { authenticate } from '../middleware/auth.js';
import { uploadFile, deleteFile } from '../utils/cloudinary.js';

export default async function documentRoutes(fastify) {
  const prisma = fastify.prisma;

  fastify.addHook('onRequest', [authenticate]);

  fastify.post('/', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'File required' });
    }

    const fields = data.fields;
    const caseId = fields.caseId?.value;
    const docCategory = fields.docCategory?.value;
    const name = fields.name?.value || data.filename;

    if (!caseId) {
      return reply.status(400).send({ error: 'caseId required' });
    }

    const buffer = await data.toBuffer();
    const result = await uploadFile(buffer, data.filename);

    const document = await prisma.document.create({
      data: {
        caseId,
        name,
        fileUrl: result.secure_url,
        fileType: data.mimetype,
        docCategory: docCategory || null,
        uploadedById: request.user.id,
      },
    });

    await prisma.action.create({
      data: {
        caseId,
        actionType: 'DOCUMENT_UPLOADED',
        description: `Document "${name}" uploaded`,
        performedById: request.user.id,
        actionDate: new Date(),
      },
    });

    return reply.status(201).send(document);
  });

  fastify.delete('/:id', async (request, reply) => {
    const document = await prisma.document.findUnique({ where: { id: request.params.id } });
    if (!document) return reply.status(404).send({ error: 'Document not found' });

    try {
      const publicId = document.fileUrl.split('/').pop().split('.')[0];
      await deleteFile(publicId);
    } catch {
      // File may already be deleted from Cloudinary
    }

    await prisma.document.delete({ where: { id: request.params.id } });
    return { message: 'Document deleted' };
  });
}
