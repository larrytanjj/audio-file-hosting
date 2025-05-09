// file-upload.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { FileUploadController } from './file-upload.controller';
import { FileUploadService } from './file-upload.service';
import { MongooseModule } from '@nestjs/mongoose';
import { AudioSchema, Audio } from './schemas/audio.schema';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: 'mongodb://mongodb:27017/audio_db',
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([{ name: Audio.name, schema: AudioSchema }]),
    MulterModule.register({
      limits: {
        fileSize: 50 * 1024 * 1024, // 10MB limit
      },
    }),
  ],
  controllers: [FileUploadController],
  providers: [FileUploadService],
  exports: [FileUploadService],
})
export class FileUploadModule {}