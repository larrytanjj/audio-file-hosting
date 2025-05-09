import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';
import { Audio, AudioDocument } from './schemas/audio.schema';

@Injectable()
export class FileUploadService {
  private minioClient: Minio.Client;
  private readonly bucketName = 'audio';

  constructor(
    private configService: ConfigService,
    @InjectModel(Audio.name) private audioModel: Model<AudioDocument>,
  ) {
    // Initialize MinIO client
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT') || 'minio',
      port: parseInt(this.configService.get<string>('MINIO_PORT') || '9000'),
      useSSL: this.configService.get<boolean>('MINIO_USE_SSL') || false,
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY') || 'minio_access_key',
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY') || 'minio_secret_key',
    });

    // Ensure bucket exists on service initialization
    this.ensureBucketExists();
  }

  private async ensureBucketExists(): Promise<void> {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
        console.log(`Bucket '${this.bucketName}' created successfully`);
      }
    } catch (error) {
      console.error('Error ensuring bucket exists:', error);
      throw new Error(`Failed to ensure bucket exists: ${error.message}`);
    }
  }

  async deleteAudioFile(fileId: string, userId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Find the audio file with matching fileId AND userId to ensure ownership
      const audioFile = await this.audioModel.findOne({ fileId, userId }).exec();
      
      if (!audioFile) {
        throw new BadRequestException('Audio file not found or you do not have permission to delete it');
      }
      
      // Delete the file from MinIO
      await this.minioClient.removeObject(this.bucketName, audioFile.fileName);
      
      // Delete the record from MongoDB
      await this.audioModel.deleteOne({ fileId, userId }).exec();
      
      return {
        success: true,
        message: 'Audio file deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting audio file:', error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException(`Failed to delete audio file: ${error.message}`);
    }
  }

  async getAudioFilesByUserId(userId: string): Promise<Audio[]> {
    try {
      // Find all audio documents for the given userId
      const audioFiles = await this.audioModel.find({ userId }).exec();
      
      if (!audioFiles || audioFiles.length === 0) {
        return [];
      }
      
      return audioFiles;
    } catch (error) {
      console.error('Error retrieving audio files:', error);
      throw new BadRequestException(`Failed to retrieve audio files: ${error.message}`);
    }
  }
  

  async uploadAudioFile(file: Express.Multer.File, metadata: AudioFileMetadata, userId: string): Promise<AudioUploadResponse> {
    try {
      if (!file) {
        throw new BadRequestException('File is required');
      }

      // Validate file type
      const acceptedMimeTypes = ['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav'];
      if (!acceptedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException('Invalid file type. Only MP3, OGG, WAV files are allowed');
      }

      // Generate a UUID for the filename
      const uuid = uuidv4();
      const fileExtension = this.getFileExtension(file.originalname);
      const filename = `${uuid}${fileExtension}`;
      
      // Upload file to MinIO
      await this.minioClient.putObject(
        this.bucketName,
        filename,
        file.buffer,
        file.buffer.length,
        {
          'Content-Type': file.mimetype,
        }
      );

      // Generate a file URL
      const fileUrl = `/api/audio/${filename}`;

      // Create a new audio document in MongoDB
      const audioRecord = new this.audioModel({
        fileId: uuid,
        fileName: filename,
        originalFilename: file.originalname,
        title: metadata.title,
        description: metadata.description,
        category: metadata.category,
        size: file.size,
        mimeType: file.mimetype,
        userId: userId,
        createdAt: new Date(),
      });

      // Save the document to MongoDB
      await audioRecord.save();

      return {
        success: true,
        fileUrl: fileUrl,
        fileId: uuid,
        metadata: {
          originalFilename: file.originalname,
          title: metadata.title,
          description: metadata.description,
          category: metadata.category,
          size: file.size,
          mimeType: file.mimetype,
        }
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new BadRequestException(`Failed to upload file: ${error.message}`);
    }
  }

  private getFileExtension(filename: string): string {
    return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 1);
  }
}

// Define interfaces for type safety
export interface AudioFileMetadata {
  title: string;
  description: string;
  category: string;
}

export interface AudioUploadResponse {
  success: boolean;
  fileUrl: string;
  fileId: string;
  metadata: {
    originalFilename: string;
    title: string;
    description: string;
    category: string;
    size: number;
    mimeType: string;
  };
}