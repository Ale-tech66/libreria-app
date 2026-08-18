import { Printer, X } from 'lucide-react';
import { useMemo } from 'react';

import type { ReciboOut } from '../api/types';
import { Modal } from './ui';

export function htmlRecibo(recibo: ReciboOut): string {
  const v = recibo.venta;
  const filas = v.detalles
    .map(
      (d) => `
      <tr>
        <td>${d.producto_nombre}</td>
        <td class="c">x${d.cantidad}</td>
        <td class="c">$${(d.precio_unitario * d.cantidad).toFixed(2)}</td>
      </tr>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Recibo ${v.id}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 13px; color: #111; width: 300px; margin: 0 auto; padding: 16px; }
    .negocio { text-align: center; margin-bottom: 12px; }
    .negocio h1 { font-size: 18px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    td { padding: 3px 0; vertical-align: top; }
    .c { text-align: right; white-space: nowrap; }
    .sep { border-top: 1px dashed #111; margin: 6px 0; }
    .fila { display: flex; justify-content: space-between; margin: 2px 0; }
    .pie { margin-top: 14px; text-align: center; }
    @media print { body { width: 100%; } }
  </style></head><body>
    <div class="negocio">
      <h1>${recibo.negocio.nombre}</h1>
      ${recibo.negocio.correo ? `<div>${recibo.negocio.correo}</div>` : ''}
      ${recibo.negocio.telefono ? `<div>${recibo.negocio.telefono}</div>` : ''}
    </div>
    <div class="sep"></div>
    <div class="fila"><span>Recibo #${v.id}</span><span>${new Date(v.fecha).toLocaleString('es-PE')}</span></div>
    ${recibo.vendedor ? `<div class="fila"><span>Vendedor</span><span>${recibo.vendedor}</span></div>` : ''}
    <div class="fila"><span>Método</span><span>${v.metodo_pago}</span></div>
    <div class="sep"></div>
    <table>${filas}</table>
    <div class="sep"></div>
    <div class="fila"><strong>TOTAL</strong><strong>$${v.total.toFixed(2)}</strong></div>
    <div class="pie">¡Gracias por tu compra!</div>
  </body></html>`;
}

export function ReciboModal({
  abierto,
  recibo,
  onCerrar,
}: {
  abierto: boolean;
  recibo: ReciboOut | null;
  onCerrar: () => void;
}) {
  const html = useMemo(() => (recibo ? htmlRecibo(recibo) : ''), [recibo]);

  const imprimir = () => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => iframe.remove(), 3000);
    }
  };

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={`Recibo #${recibo?.venta.id ?? ''}`}>
      {recibo && (
        <>
          <div className="recibo-vista">
            <div className="recibo-negocio">
              <strong>{recibo.negocio.nombre}</strong>
              {recibo.negocio.correo && <span>{recibo.negocio.correo}</span>}
              {recibo.negocio.telefono && <span>{recibo.negocio.telefono}</span>}
            </div>
            <div className="recibo-fila">
              <span>Recibo #{recibo.venta.id}</span>
              <span>{new Date(recibo.venta.fecha).toLocaleString('es-PE')}</span>
            </div>
            {recibo.vendedor && (
              <div className="recibo-fila">
                <span>Vendedor</span>
                <span>{recibo.vendedor}</span>
              </div>
            )}
            <div className="recibo-fila">
              <span>Método</span>
              <span>{recibo.venta.metodo_pago}</span>
            </div>
            <div className="recibo-sep" />
            {recibo.venta.detalles.map((d) => (
              <div className="recibo-fila" key={d.id}>
                <span>
                  {d.producto_nombre} × {d.cantidad}
                </span>
                <span>${(d.precio_unitario * d.cantidad).toFixed(2)}</span>
              </div>
            ))}
            <div className="recibo-sep" />
            <div className="recibo-fila recibo-total">
              <strong>TOTAL</strong>
              <strong>${recibo.venta.total.toFixed(2)}</strong>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="boton boton-primario" onClick={imprimir} style={{ flex: 1 }}>
              <Printer size={17} /> Imprimir
            </button>
            <button className="boton boton-secundario" onClick={onCerrar} style={{ flex: 1 }}>
              <X size={17} /> Cerrar
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}