import { ipcMain, app } from 'electron';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

export function setupAIHandlers() {
  // Generate AI Image using DALL-E
  ipcMain.handle('ai:generateImage', async (event, apiKey: string, prompt: string, model: string) => {
    try {
      const openai = new OpenAI({ apiKey });

      const response = await openai.images.generate({
        model,
        prompt,
        n: 1,
        size: model === 'dall-e-3' ? '1024x1024' : '512x512',
        quality: model === 'dall-e-3' ? 'standard' : undefined,
      });

      const imageUrl = response.data[0]?.url;
      if (!imageUrl) {
        throw new Error('No image URL returned from OpenAI');
      }

      // Download the image
      const userDataPath = app.getPath('userData');
      const aiDir = path.join(userDataPath, 'ai-generated');
      if (!fs.existsSync(aiDir)) {
        fs.mkdirSync(aiDir, { recursive: true });
      }

      const filename = `ai-image-${Date.now()}.png`;
      const imagePath = path.join(aiDir, filename);

      await downloadFile(imageUrl, imagePath);

      return {
        success: true,
        imagePath,
      };
    } catch (error) {
      console.error('❌ AI image generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate image',
      };
    }
  });

  // Generate AI Video using Sora
  ipcMain.handle('ai:generateVideo', async (event, apiKey: string, prompt: string, model: string) => {
    try {
      const openai = new OpenAI({ apiKey });

      // Note: Sora API might have different endpoint/parameters
      // This is a placeholder - adjust based on actual API
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{
          role: 'system',
          content: 'You are a video generation assistant. Respond with: "Sora video generation is not yet available in the API. Please use image generation for now."'
        }, {
          role: 'user',
          content: prompt
        }],
      });

      // Placeholder response
      throw new Error('Sora video generation is not yet available in the OpenAI API. Please use image generation for now, or wait for Sora API access.');

    } catch (error) {
      console.error('❌ AI video generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate video',
      };
    }
  });
}

// Helper function to download file
function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(destPath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', (err) => {
        fs.unlinkSync(destPath);
        reject(err);
      });
    }).on('error', reject);
  });
}
