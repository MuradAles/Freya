import { useState } from 'react';
import { X, Sparkles, Loader2, RotateCcw, Save, Image as ImageIcon, Settings, Key } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';

interface AIVideoDialogProps {
  onClose: () => void;
  onVideoGenerated: (videoPath: string) => void;
}

type ImageModel = 'dall-e-3' | 'dall-e-2';

export default function AIVideoDialog({ onClose, onVideoGenerated }: AIVideoDialogProps) {
  const { openaiApiKey, setOpenAiApiKey } = useSettingsStore();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageModel, setImageModel] = useState<ImageModel>('dall-e-3');
  const [generatedPreview, setGeneratedPreview] = useState<string | null>(null);
  const [generatedTempPath, setGeneratedTempPath] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(openaiApiKey);
  const [showKey, setShowKey] = useState(false);

  const handleGenerate = async () => {
    if (!openaiApiKey) {
      setError('Please set your OpenAI API key in Settings first');
      return;
    }

    if (!prompt.trim()) {
      setError('Please enter a description for your image');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Generate image with DALL-E
      const result = await window.electronAPI?.generateAIImage?.(
        openaiApiKey,
        prompt,
        imageModel
      );

      if (result?.success && result?.imagePath) {
        // Load preview as data URL
        const dataUrl = await window.electronAPI?.readFileAsDataURL?.(result.imagePath);
        if (dataUrl) {
          setGeneratedPreview(dataUrl);
          setGeneratedTempPath(result.imagePath);
        } else {
          setError('Failed to load image preview');
          await window.electronAPI?.deleteFile?.(result.imagePath);
        }
      } else {
        setError(result?.error || 'Failed to generate image');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedTempPath) return;

    try {
      const savePath = await window.electronAPI?.showSaveDialog?.({
        title: 'Save Generated Image',
        defaultPath: `ai-generated-${Date.now()}.png`,
        filters: [{ name: 'Images', extensions: ['png'] }]
      });

      if (savePath) {
        // Copy file to chosen location
        await window.electronAPI?.copyFile?.(generatedTempPath, savePath);
        // Add to media library
        onVideoGenerated(savePath);
        // Clean up temp file
        await window.electronAPI?.deleteFile?.(generatedTempPath);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file');
    }
  };

  const handleRegenerate = async () => {
    // Clean up old temp file
    if (generatedTempPath) {
      await window.electronAPI?.deleteFile?.(generatedTempPath);
    }
    // Reset preview
    setGeneratedPreview(null);
    setGeneratedTempPath(null);
    setError(null);
  };

  const handleCancel = async () => {
    // Clean up temp file if exists
    if (generatedTempPath) {
      await window.electronAPI?.deleteFile?.(generatedTempPath);
    }
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    // Close dialog if clicking on the overlay (not the dialog content)
    if (e.target === e.currentTarget && !isGenerating) {
      handleCancel();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleOverlayClick}
    >
      <div 
        className="bg-gray-800 rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Generate AI Image
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-gray-700 rounded"
              title="Settings"
              disabled={isGenerating}
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-gray-700 rounded"
              disabled={isGenerating}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Settings Section */}
        {showSettings && (
          <div className="mb-4 p-4 bg-gray-700/50 rounded-lg border border-gray-600">
            <div className="flex items-center gap-2 mb-3">
              <Key className="w-4 h-4 text-purple-400" />
              <label className="text-sm font-medium text-gray-300">
                OpenAI API Key
              </label>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              Required for AI image generation. Get your key from{' '}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 underline"
              >
                OpenAI Platform
              </a>
            </p>
            <div className="relative mb-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 bg-gray-900 text-white rounded border border-gray-600 focus:border-purple-500 focus:outline-none pr-20"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-white"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className="flex items-center justify-between">
              {apiKey && (
                <p className="text-xs text-green-400">
                  ✓ API key configured
                </p>
              )}
              <button
                onClick={() => {
                  setOpenAiApiKey(apiKey);
                  setShowSettings(false);
                }}
                className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {!openaiApiKey && !showSettings && (
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-400 text-sm">
            ⚠️ No OpenAI API key configured. Click the Settings button to add your key.
          </div>
        )}

        {/* Preview Section */}
        {generatedPreview && (
          <div className="mb-4">
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Generated Image Preview</h3>
              <img
                src={generatedPreview}
                alt="Generated preview"
                className="w-full rounded border border-gray-600"
              />
            </div>
          </div>
        )}

        {!generatedPreview && (
          <div className="space-y-4">
            {/* Model Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Model
              </label>
              <select
                value={imageModel}
                onChange={(e) => setImageModel(e.target.value as ImageModel)}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
                disabled={isGenerating}
              >
                <option value="dall-e-3">DALL-E 3 (Best Quality)</option>
                <option value="dall-e-2">DALL-E 2 (Faster, Lower Cost)</option>
              </select>
            </div>

            {/* Prompt */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Describe your image
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Example: A modern logo design with purple gradient, minimalist style, on dark background..."
                className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-purple-500 focus:outline-none resize-none h-32"
                disabled={isGenerating}
              />
              <p className="text-xs text-gray-400 mt-1">
                AI will generate an image based on your description
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 mt-6">
          {!generatedPreview ? (
            <>
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isGenerating}
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                disabled={isGenerating || !openaiApiKey}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-4 h-4" />
                    Generate Image
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRegenerate}
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Regenerate
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save & Add to Library
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
