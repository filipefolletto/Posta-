import type { ChangeEvent, DragEvent } from 'react';
import { useRef, useState } from 'react';
import type { PhotoAsset } from '../types';
import { Icon } from './Icon';

export const MAX_PHOTOS = 6;

interface PhotoUploaderProps {
  photos: PhotoAsset[];
  busy: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  onMakeCover: (id: string) => void;
}

export function PhotoUploader({
  photos,
  busy,
  onAdd,
  onRemove,
  onMakeCover,
}: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const remaining = MAX_PHOTOS - photos.length;

  function openPicker() {
    inputRef.current?.click();
  }

  function handleFiles(files: FileList | null) {
    if (busy || !files || files.length === 0) return;
    onAdd(Array.from(files));
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    handleFiles(event.target.files);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer.files);
  }

  return (
    <div className="field photo-field">
      <div className="field-head">
        <span className="field-label">Fotos do post</span>
        <span className="field-hint">
          opcional · {photos.length}/{MAX_PHOTOS}
        </span>
      </div>

      <input
        ref={inputRef}
        className="photo-input"
        type="file"
        accept="image/*"
        multiple
        onChange={handleChange}
        tabIndex={-1}
        aria-hidden="true"
      />

      {photos.length === 0 ? (
        <button
          type="button"
          className={`photo-dropzone${dragging ? ' is-dragging' : ''}`}
          onClick={openPicker}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          disabled={busy || remaining <= 0}
        >
          <span className="photo-dropzone-icon">
            {busy ? <span className="spinner" /> : <Icon name="image" size={20} />}
          </span>
          <strong>{busy ? 'Preparando as fotos…' : 'Adicione fotos ao post'}</strong>
          <small>
            Arraste ou clique para enviar · JPG, PNG ou WebP · até {MAX_PHOTOS} fotos
          </small>
        </button>
      ) : (
        <div
          className={`photo-grid${dragging ? ' is-dragging' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          {photos.map((photo, index) => (
            <div className="photo-thumb" key={photo.id}>
              <img src={photo.url} alt={photo.name} />
              {index === 0 ? (
                <span className="photo-thumb-cover">Capa</span>
              ) : (
                <button
                  type="button"
                  className="photo-thumb-cover-btn"
                  onClick={() => onMakeCover(photo.id)}
                  title="Usar como capa e referência de cor"
                  aria-label={`Usar ${photo.name} como capa`}
                >
                  <Icon name="target" size={10} /> capa
                </button>
              )}
              <button
                type="button"
                className="photo-thumb-remove"
                onClick={() => onRemove(photo.id)}
                title="Remover foto"
                aria-label={`Remover ${photo.name}`}
              >
                <Icon name="close" size={11} />
              </button>
            </div>
          ))}

          {remaining > 0 && (
            <button
              type="button"
              className="photo-add-tile"
              onClick={openPicker}
              disabled={busy}
            >
              {busy ? (
                <span className="spinner" />
              ) : (
                <>
                  <Icon name="image" size={17} />
                  <span>Adicionar</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {photos.length > 0 && (
        <p className="field-hint">
          A primeira foto é a capa e define a paleta. A IA ajusta as outras para
          combinarem.
        </p>
      )}
    </div>
  );
}
