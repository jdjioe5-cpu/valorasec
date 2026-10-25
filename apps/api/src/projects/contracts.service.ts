import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface UploadedContractFile {
  fieldname?: string;
  originalname: string;
  encoding?: string;
  mimetype?: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  processSourceFile(
    file: UploadedContractFile,
    projectId: string,
  ): { sourceHash: string; sourcePath: string } {
    if (!file.originalname.toLowerCase().endsWith('.rs')) {
      throw new BadRequestException('Only .rs files are accepted');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds 5MB limit');
    }

    const sourceHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const uploadBaseDir =
      process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads', 'contracts');
    const projectDir = path.join(uploadBaseDir, projectId);
    fs.mkdirSync(projectDir, { recursive: true });

    const safeFilename = `${Date.now()}-${path.basename(file.originalname)}`;
    const sourcePath = path.join(projectDir, safeFilename);
    fs.writeFileSync(sourcePath, file.buffer);

    return { sourceHash, sourcePath };
  }

  async findAll(projectId: string) {
    const contracts = await this.prisma.contract.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    return contracts;
  }

  async create(
    projectId: string,
    data: {
      name: string;
      address: string;
      network: string;
      sourceHash?: string;
      sourcePath?: string;
    },
    file?: UploadedContractFile,
  ) {
    let sourceHash = data.sourceHash;
    let sourcePath = data.sourcePath;

    if (file) {
      const processed = this.processSourceFile(file, projectId);
      sourceHash = processed.sourceHash;
      sourcePath = processed.sourcePath;
    }

    return this.prisma.contract.create({
      data: {
        name: data.name,
        address: data.address,
        network: data.network,
        sourceHash,
        sourcePath,
        projectId,
      },
    });
  }

  async remove(projectId: string, contractId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, projectId },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    // Optionally cleanup uploaded source file
    if (contract.sourcePath && fs.existsSync(contract.sourcePath)) {
      try {
        fs.unlinkSync(contract.sourcePath);
      } catch {
        // Ignore deletion errors for clean state
      }
    }

    await this.prisma.contract.delete({ where: { id: contractId } });
  }
}
