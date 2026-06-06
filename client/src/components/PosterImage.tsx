import type { ReactNode } from 'react';

type PosterImageProps = {
  src?: string | null;
  alt: string;
  children?: ReactNode;
};

export function PosterImage({ src, alt, children }: PosterImageProps) {
  return (
    <div className="relative aspect-[2/3] w-full overflow-hidden bg-surface-hover">
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-contain object-center transition group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-gray-500">No image</div>
      )}
      {children}
    </div>
  );
}
