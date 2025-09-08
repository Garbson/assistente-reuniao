export const formatDuration = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds
    .toString()
    .padStart(2, '0')}`;
};

export const formatFileSize = (bytes) => {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)}MB`;
};

export const formatTimestamp = (date = new Date()) => {
  return date.toISOString()
    .slice(0, 19)
    .replace(/:/g, '-');
};

export const downloadFile = (content, filename, type = 'text/plain') => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};