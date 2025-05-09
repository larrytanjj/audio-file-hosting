// file-upload.controller.ts
import { Controller, Post, UploadedFile, Body, UseInterceptors, UseGuards, Req, Get, Delete, Param } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileUploadService, AudioFileMetadata } from './file-upload.service';
import { ApiConsumes, ApiBody, ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { jwtDecode } from 'jwt-decode';

@ApiTags('file-upload')
@Controller('file')
export class FileUploadController {
  constructor(private readonly fileUploadService: FileUploadService) { }

  @Delete(':id')
  async deleteAudioFile(
    @Param('id') fileId: string,
    @Req() request: any,
  ) {
    const authHeader = request.headers.authorization;
    const token = authHeader?.split(' ')[1];
    const object = jwtDecode(token);
    return this.fileUploadService.deleteAudioFile(fileId, object.sub);
  }

  @Get('/')
  async getUserAudioFiles(@Req() request: any) {
    const authHeader = request.headers.authorization;
    const token = authHeader?.split(' ')[1];
    const object = jwtDecode(token);
    return this.fileUploadService.getAudioFilesByUserId(object.sub);
  }

  @Post('/upload')
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        title: {
          type: 'string',
        },
        description: {
          type: 'string',
        },
        category: {
          type: 'string',
        },
      },
    },
  })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() metadata: AudioFileMetadata,
    @Req() request: any,
  ) {
    const authHeader = request.headers.authorization;
    const token = authHeader?.split(' ')[1];
    const object = jwtDecode(token);
    return this.fileUploadService.uploadAudioFile(file, metadata, object.sub);
  }


}