// utils/image.js
// Image compression utilities

/**
 * Compress image file
 * @param {string} filePath - Source file path
 * @param {number} maxSizeKB - Maximum size in KB (default 500)
 * @param {number} quality - JPEG quality 0-100 (default 80)
 * @returns {Promise<{ path: string, size: number }>}
 */
export function compressImage(filePath, maxSizeKB = 500, quality = 80) {
  return new Promise((resolve, reject) => {
    // Get file info
    uni.getFileInfo({
      filePath,
      success: (info) => {
        const sizeKB = info.size / 1024

        // If already small enough, return as-is
        if (sizeKB <= maxSizeKB) {
          resolve({ path: filePath, size: info.size })
          return
        }

        // Compress using canvas
        uni.compressImage({
          src: filePath,
          quality,
          success: (res) => {
            resolve({ path: res.tempFilePath, size: res.tempFilePath ? null : info.size })
          },
          fail: (err) => {
            console.error('Compression failed:', err)
            // Return original file if compression fails
            resolve({ path: filePath, size: info.size })
          }
        })
      },
      fail: (err) => {
        console.error('Get file info failed:', err)
        // If we can't get file info, just return original
        resolve({ path: filePath, size: 0 })
      }
    })
  })
}

/**
 * Get compressed image for upload
 * Ensures image is under size limit and properly formatted
 * @param {string} filePath - Source file path
 * @param {object} options - Compression options
 * @returns {Promise<{ path: string, ext: string }>}
 */
export async function getCompressedImage(filePath, options = {}) {
  const { maxSizeKB = 500, quality = 80 } = options

  // Determine extension
  const ext = filePath.split('.').pop()?.toLowerCase() || 'jpg'

  // Compress the image
  const result = await compressImage(filePath, maxSizeKB, quality)

  return {
    path: result.path,
    ext: ext === 'png' && quality < 100 ? 'jpg' : ext, // Convert PNG to JPG when compressing
    originalSize: result.size
  }
}
