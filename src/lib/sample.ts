/** Creates a small, original landscape sample entirely in the browser. */
export async function createSampleFile(): Promise<File> {
  const width = 1800;
  const height = 1200;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not create the sample image.');

  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#6254a6');
  sky.addColorStop(0.48, '#db8c91');
  sky.addColorStop(1, '#f2c99b');
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  const sun = context.createRadialGradient(1270, 420, 20, 1270, 420, 250);
  sun.addColorStop(0, 'rgba(255, 239, 195, 0.72)');
  sun.addColorStop(1, 'rgba(255, 239, 195, 0)');
  context.fillStyle = sun;
  context.fillRect(900, 80, 740, 740);
  context.beginPath();
  context.arc(1270, 420, 115, 0, Math.PI * 2);
  context.fillStyle = '#ffe8ba';
  context.fill();

  const mountain = (points: Array<[number, number]>, color: string) => {
    context.beginPath();
    context.moveTo(points[0][0], height);
    for (const [x, y] of points) context.lineTo(x, y);
    context.lineTo(width, height);
    context.closePath();
    context.fillStyle = color;
    context.fill();
  };
  mountain([[0, 700], [150, 560], [340, 730], [620, 450], [900, 740], [1160, 580], [1450, 740], [1680, 520], [1800, 670]], '#777c9d');
  mountain([[0, 820], [220, 680], [470, 850], [780, 610], [1040, 850], [1320, 690], [1570, 850], [1800, 700]], '#586d78');
  mountain([[0, 930], [250, 790], [520, 950], [830, 750], [1110, 970], [1440, 780], [1800, 960]], '#405b58');
  const foreground = context.createLinearGradient(0, 820, 0, height);
  foreground.addColorStop(0, '#50654e');
  foreground.addColorStop(1, '#263e3e');
  context.fillStyle = foreground;
  context.fillRect(0, 970, width, height - 970);

  try {
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('The browser could not encode the sample image.')), 'image/jpeg', 0.9));
    return new File([blob], 'mountain-sunset.jpg', { type: 'image/jpeg' });
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
