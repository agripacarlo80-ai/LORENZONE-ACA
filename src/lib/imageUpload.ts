export async function compressProfilePhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file (JPG, PNG, or WebP).');
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Invalid image format. Please choose a JPG or PNG photo.'));
    image.src = dataUrl;
  });

  const renderSquare = (size: number, quality: number): string => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Image processing is unavailable in this browser.');
    }
    const minSide = Math.min(img.width, img.height);
    const sx = Math.max(0, Math.floor((img.width - minSide) / 2));
    const sy = Math.max(0, Math.floor((img.height - minSide) / 2));
    ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', quality);
  };

  let compressed = renderSquare(160, 0.75);
  if (compressed.length > 26000) {
    compressed = renderSquare(128, 0.6);
  }
  if (compressed.length > 28500) {
    compressed = renderSquare(96, 0.5);
  }
  if (compressed.length > 29500) {
    throw new Error('Photo is still too large after compression. Please pick a simpler photo.');
  }
  return compressed;
}

export async function compressSchoolIdImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file (JPG, PNG, or WebP) of your School ID.');
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the selected School ID image.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Invalid image format. Please choose a JPG or PNG photo.'));
    image.src = dataUrl;
  });

  const renderScaled = (maxDim: number, quality: number): string => {
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height, 1));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Image processing is unavailable in this browser.');
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  };

  let compressed = renderScaled(560, 0.78);
  if (compressed.length > 95000) {
    compressed = renderScaled(460, 0.7);
  }
  if (compressed.length > 95000) {
    compressed = renderScaled(360, 0.62);
  }
  if (compressed.length > 135000) {
    throw new Error('School ID image is still too large after compression. Please upload a clearer cropped photo.');
  }
  return compressed;
}

export async function compressCluePhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file (JPG, PNG, or WebP).');
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the selected clue photo.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Invalid image format. Please choose a JPG or PNG photo.'));
    image.src = dataUrl;
  });

  const renderSquare = (size: number, quality: number): string => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Image processing is unavailable in this browser.');
    }
    const minSide = Math.min(img.width, img.height);
    const sx = Math.max(0, Math.floor((img.width - minSide) / 2));
    const sy = Math.max(0, Math.floor((img.height - minSide) / 2));
    ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', quality);
  };

  let compressed = renderSquare(140, 0.72);
  if (compressed.length > 11000) {
    compressed = renderSquare(112, 0.58);
  }
  if (compressed.length > 12500) {
    compressed = renderSquare(96, 0.48);
  }
  if (compressed.length > 14000) {
    throw new Error('Clue photo is too large after compression. Please choose a simpler image.');
  }
  return compressed;
}
