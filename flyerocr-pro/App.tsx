
import React, { useState, useEffect, useRef } from 'react';
import { 
  CloudArrowUpIcon,
  TableCellsIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  SparklesIcon,
  CheckBadgeIcon,
  MagnifyingGlassIcon,
  CameraIcon,
  PhotoIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { ProductData, AppStatus } from './types';
import { extractProductData } from './services/geminiService';
import * as XLSX from 'xlsx';

const App: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [products, setProducts] = useState<ProductData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [excelFilename, setExcelFilename] = useState<string>('');
  const [showZoom, setShowZoom] = useState(false);
  const [zoomStyle, setZoomStyle] = useState<React.CSSProperties>({});
  const [isCameraActive, setIsCameraActive] = useState(false);
  
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Automated Analysis on Upload or Capture
  useEffect(() => {
    if (image && status === AppStatus.IDLE) {
      processFlyer();
    }
  }, [image, status]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setProducts([]);
        setError(null);
        setStatus(AppStatus.IDLE);
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    setIsCameraActive(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError("Camera access denied or unavailable.");
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setImage(dataUrl);
        setProducts([]);
        setStatus(AppStatus.IDLE); // Trigger useEffect for auto-scan
        stopCamera();
      }
    }
  };

  const processFlyer = async () => {
    if (!image) return;
    setStatus(AppStatus.LOADING);
    setError(null);
    try {
      const data = await extractProductData(image);
      setProducts(data);
      setStatus(AppStatus.SUCCESS);
    } catch (err: any) {
      setError(err.message);
      setStatus(AppStatus.ERROR);
    }
  };

  const downloadExcel = () => {
    if (products.length === 0 || !excelFilename.trim()) return;

    const headers = [
      "Barcode", 
      "Scale Code", 
      "Description", 
      "Arabic Description", 
      "Qty", 
      "Regular Price", 
      "Offer Price"
    ];

    const dataRows = products.map(p => {
      const formatPrice = (priceStr: string) => {
        if (!priceStr || priceStr.trim() === "") return "";
        const val = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
        return isNaN(val) ? "" : val.toFixed(2);
      };

      const cleanDescription = (desc: string) => {
        return desc.replace(/[*"#]/g, '').trim();
      };

      return [
        "", // Barcode
        "", // Scale Code
        cleanDescription(p.description),
        p.arabicDescription || "",
        (p.qty && p.qty > 1) ? p.qty : "",
        formatPrice(p.regularPrice),
        formatPrice(p.offerPrice)
      ];
    });

    const worksheetData = [headers, ...dataRows];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    
    const range = XLSX.utils.decode_range(worksheet['!ref']!);
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      [5, 6].forEach(C => {
        const cell = worksheet[XLSX.utils.encode_cell({r: R, c: C})];
        if (cell && cell.v !== "") {
          cell.t = 'n';
          cell.z = '0.00'; 
        }
      });
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Flyer_Capture");
    XLSX.writeFile(workbook, `${excelFilename.trim()}.xlsx`);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current || status === AppStatus.LOADING || isCameraActive) return;

    const { left, top, width, height } = imageRef.current.getBoundingClientRect();
    const cursorX = e.clientX - left;
    const cursorY = e.clientY - top;

    if (cursorX < 0 || cursorX > width || cursorY < 0 || cursorY > height) {
      setShowZoom(false);
      return;
    }

    const relX = cursorX / width;
    const relY = cursorY / height;
    const zoomFactor = 3; 

    setZoomStyle({
      left: `${cursorX}px`,
      top: `${cursorY}px`,
      backgroundImage: `url(${image})`,
      backgroundSize: `${width * zoomFactor}px ${height * zoomFactor}px`,
      backgroundPosition: `${relX * 100}% ${relY * 100}%`,
      transform: 'translate(-50%, -50%)',
    });
    
    if (!showZoom) setShowZoom(true);
  };

  const clearAll = () => {
    setImage(null);
    setProducts([]);
    setStatus(AppStatus.IDLE);
    setError(null);
    setExcelFilename('');
    setShowZoom(false);
    stopCamera();
  };

  const isDownloadDisabled = products.length === 0 || status === AppStatus.LOADING || !excelFilename.trim();

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-900 selection:bg-black selection:text-white font-sans overflow-x-hidden">
      <nav className="bg-white border-b border-slate-100 py-4 px-6 md:px-10 sticky top-0 z-50 backdrop-blur-md bg-white/80">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-black rounded shadow-lg shadow-black/20">
              <TableCellsIcon className="h-5 w-5 text-white" />
            </div>
            <span className="text-sm font-black tracking-tighter uppercase">FlyerOCR.Precision v6.1</span>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border shadow-sm transition-all ${status === AppStatus.LOADING ? 'border-indigo-100 bg-indigo-50 text-indigo-600' : 'border-emerald-100 bg-emerald-50 text-emerald-600'}`}>
              <div className={`h-1.5 w-1.5 rounded-full ${status === AppStatus.LOADING ? 'bg-indigo-500 animate-pulse' : 'bg-emerald-500'}`}></div>
              <span className="text-[9px] font-black uppercase tracking-widest">{status === AppStatus.LOADING ? 'Neural Map' : 'System Secure'}</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          
          <div className="lg:col-span-6 space-y-6">
            <div className="relative group">
              <div className="absolute -inset-1.5 bg-gradient-to-tr from-indigo-50 to-emerald-50 rounded-[2.5rem] blur opacity-30 transition duration-1000"></div>
              <div 
                className={`relative bg-white border border-slate-200 rounded-[2.5rem] p-3 shadow-2xl shadow-slate-200/40 min-h-[500px] flex items-center justify-center overflow-hidden transition-all ${(!image || isCameraActive) ? 'cursor-default' : 'cursor-none'}`}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setShowZoom(false)}
              >
                {!image && !isCameraActive ? (
                  <div className="flex flex-col gap-4 w-full h-[480px]">
                    <label className="flex flex-col items-center justify-center flex-1 cursor-pointer hover:bg-slate-50 transition-all rounded-[2rem] border-2 border-dashed border-slate-100 group/label">
                      <div className="p-6 bg-slate-50 rounded-full mb-6 group-hover/label:scale-110 group-hover/label:bg-white group-hover/label:shadow-xl transition-all duration-500">
                        <PhotoIcon className="h-10 w-10 text-slate-300" />
                      </div>
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">Upload Image</span>
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                    <button 
                      onClick={startCamera}
                      className="flex flex-col items-center justify-center h-48 cursor-pointer hover:bg-indigo-50 transition-all rounded-[2rem] border-2 border-dashed border-indigo-100 group/camera bg-white shadow-sm"
                    >
                      <div className="p-5 bg-indigo-50 rounded-full mb-4 group-hover/camera:scale-110 group-hover/camera:bg-white group-hover/camera:shadow-xl transition-all duration-500">
                        <CameraIcon className="h-8 w-8 text-indigo-300" />
                      </div>
                      <span className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.4em]">Open Camera Capture</span>
                    </button>
                  </div>
                ) : isCameraActive ? (
                  <div className="relative w-full h-[480px] bg-black rounded-[2rem] overflow-hidden">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <div className="absolute inset-0 border-[2px] border-white/20 pointer-events-none flex items-center justify-center">
                       <div className="w-3/4 h-3/4 border border-white/40 border-dashed rounded-lg"></div>
                    </div>
                    <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-6">
                      <button onClick={stopCamera} className="p-4 bg-white/10 backdrop-blur-md rounded-full border border-white/20 hover:bg-white/20 transition-all text-white">
                        <XMarkIcon className="h-6 w-6" />
                      </button>
                      <button onClick={capturePhoto} className="p-6 bg-white rounded-full shadow-2xl hover:scale-110 active:scale-90 transition-all">
                        <div className="w-6 h-6 rounded-full border-4 border-black"></div>
                      </button>
                      <div className="w-14"></div>
                    </div>
                  </div>
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img 
                      ref={imageRef}
                      src={image!} 
                      alt="Input" 
                      className={`max-h-[600px] w-auto object-contain rounded-2xl transition-all duration-1000 ${status === AppStatus.LOADING ? 'scale-95 brightness-90 blur-[0.5px]' : 'scale-100'}`} 
                    />

                    {showZoom && !error && status !== AppStatus.LOADING && (
                      <div 
                        className="absolute w-52 h-52 border-4 border-white rounded-full shadow-[0_25px_60px_rgba(0,0,0,0.5)] pointer-events-none z-[100] bg-no-repeat overflow-hidden bg-white"
                        style={zoomStyle}
                      />
                    )}
                    
                    {status === AppStatus.LOADING && (
                      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl bg-white/20 backdrop-blur-[2px]">
                        <div className="absolute left-0 right-0 h-[4px] bg-indigo-500 shadow-[0_0_50px_rgba(99,102,241,1),0_0_100px_rgba(99,102,241,0.5)] animate-scan z-20"></div>
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-transparent via-indigo-500/10 to-transparent">
                           <div className="flex flex-col items-center gap-6">
                              <div className="relative">
                                <ArrowPathIcon className="h-16 w-16 text-indigo-600 animate-spin" />
                                <SparklesIcon className="absolute -top-1 -right-1 h-8 w-8 text-amber-400 animate-bounce" />
                              </div>
                              <span className="text-[12px] font-black text-indigo-900 uppercase tracking-[0.8em] drop-shadow-sm bg-white/80 px-8 py-2.5 rounded-full backdrop-blur-md border border-white/50 animate-pulse">Deep Analyzing...</span>
                           </div>
                        </div>
                      </div>
                    )}

                    <div className="absolute top-4 right-4 z-[110]">
                       <button onClick={clearAll} className="p-2.5 bg-white/80 backdrop-blur-md border border-slate-200 rounded-full shadow-xl hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all active:scale-90">
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <canvas ref={canvasRef} className="hidden" />

            {error && (
              <div className="p-6 bg-red-50/90 border border-red-100 rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-left-4 duration-500 backdrop-blur-sm">
                <div className="p-3 bg-red-100 rounded-xl"><ExclamationCircleIcon className="h-6 w-6 text-red-600" /></div>
                <div className="space-y-1">
                  <p className="text-sm font-black text-red-800 uppercase tracking-tighter">Extraction Error</p>
                  <p className="text-xs font-bold text-red-700/70 leading-relaxed">{error}</p>
                </div>
              </div>
            )}
            
            {image && status === AppStatus.SUCCESS && !isCameraActive && (
              <div className="flex items-center gap-3 px-6 py-4 bg-slate-50 rounded-2xl border border-slate-100 animate-in slide-in-from-bottom-2">
                <div className="p-1.5 bg-indigo-100 rounded-lg"><MagnifyingGlassIcon className="h-4 w-4 text-indigo-600" /></div>
                <div className="flex flex-col">
                   <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Inspection Lens Enabled</span>
                   <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Hover image for 300% live detail verification</span>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-6 space-y-10">
            <div className="bg-white border border-slate-100 rounded-[3rem] p-12 shadow-sm space-y-10 relative overflow-hidden transition-all hover:shadow-2xl hover:shadow-indigo-50/50">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-2xl font-black tracking-tight text-slate-900">Elite Catalog Export</h2>
                  <div className="h-1.5 w-16 bg-indigo-500 rounded-full"></div>
                </div>
                {status === AppStatus.SUCCESS && <CheckBadgeIcon className="h-8 w-8 text-emerald-500 animate-in zoom-in" />}
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <DocumentTextIcon className="h-4 w-4 text-slate-400" />
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">File Name / Export Label</label>
                  </div>
                  <div className="relative group/input">
                    <input 
                      type="text" 
                      placeholder="Enter File Name Here"
                      value={excelFilename}
                      onChange={(e) => setExcelFilename(e.target.value)}
                      className="w-full bg-white border-2 border-slate-200 px-7 py-6 rounded-[1.5rem] text-xl font-bold text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-8 focus:ring-indigo-500/10 transition-all placeholder:text-slate-300 shadow-sm"
                    />
                    <div className="absolute bottom-0 left-7 right-7 h-0.5 bg-indigo-600 scale-x-0 group-focus-within/input:scale-x-100 transition-transform origin-left"></div>
                  </div>
                </div>

                <button 
                  disabled={isDownloadDisabled}
                  onClick={downloadExcel}
                  className={`w-full py-7 rounded-[1.5rem] font-black text-lg uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-4 border-2 shadow-sm ${
                    isDownloadDisabled 
                    ? 'border-slate-50 bg-slate-50 text-slate-300 cursor-not-allowed grayscale' 
                    : 'border-black bg-white text-black hover:bg-black hover:text-white shadow-2xl shadow-black/10 active:scale-[0.98]'
                  }`}
                >
                  <ArrowDownTrayIcon className="h-6 w-6" />
                  Finalize Structured .XLSX
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between px-6">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Audit Registry</h3>
                {status === AppStatus.SUCCESS && (
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-100 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full"></div>
                    {products.length} Products Verified
                  </span>
                )}
              </div>

              <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm min-h-[300px]">
                {status === AppStatus.LOADING ? (
                  <div className="p-10 space-y-6">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="flex items-center gap-6 animate-pulse-subtle">
                        <div className="h-12 w-12 bg-slate-100 rounded-2xl shrink-0"></div>
                        <div className="flex-1 space-y-3">
                          <div className="h-4 bg-slate-100 rounded-full w-3/4"></div>
                          <div className="h-3 bg-slate-100/60 rounded-full w-1/2"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : products.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-slate-50/40">
                          <th className="p-6 font-black border-b border-slate-100 uppercase text-slate-400 tracking-widest">Captured Description</th>
                          <th className="p-6 font-black border-b border-slate-100 uppercase text-center text-slate-400 tracking-widest">Qty</th>
                          <th className="p-6 font-black border-b border-slate-100 uppercase text-right text-slate-400 tracking-widest">Offer Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {products.slice(0, 8).map((p, i) => (
                          <tr key={i} className="group hover:bg-slate-50/50 transition-colors">
                            <td className="p-6 font-bold text-slate-900">
                              <div className="flex flex-col gap-1">
                                <span className="truncate max-w-[280px] group-hover:text-indigo-600 transition-colors">{p.description}</span>
                                <span className="text-[9px] text-slate-400 font-medium truncate max-w-[280px]">
                                  {p.arabicDescription || <span className="italic opacity-20 text-[8px] uppercase tracking-tighter">Blank - Printed Arabic only</span>}
                                </span>
                              </div>
                            </td>
                            <td className="p-6 text-center font-black text-slate-300 group-hover:text-slate-500">
                              { (p.qty && p.qty > 1) ? p.qty : <span className="text-slate-100">--</span>}
                            </td>
                            <td className="p-6 text-right font-black text-black">
                              {p.offerPrice ? parseFloat(p.offerPrice).toFixed(2) : <span className="text-slate-200">--</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-20 text-center space-y-4">
                    <div className="inline-block p-6 bg-slate-50 rounded-full border border-slate-100"><SparklesIcon className="h-8 w-8 text-slate-200" /></div>
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Asset Buffer Empty</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-10 py-24 border-t border-slate-50 mt-16 grid grid-cols-1 md:grid-cols-4 gap-16">
        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-black uppercase tracking-widest">Instant Auto-Scan</h4>
          <p className="text-[11px] text-slate-400 font-medium leading-relaxed">Capture via high-res camera feed and the neural pipeline engages immediately. Zero latency in metadata mapping.</p>
        </div>
        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-black uppercase tracking-widest">Arabic Isolation</h4>
          <p className="text-[11px] text-slate-400 font-medium leading-relaxed">System strictly isolates visible Arabic printed text. Zero auto-translation. Measurements normalized with single-space padding.</p>
        </div>
        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-black uppercase tracking-widest">Inspection Lens</h4>
          <p className="text-[11px] text-slate-400 font-medium leading-relaxed">Interactive 300% zoom allows manual verification of small price tags and fine print before structured export.</p>
        </div>
        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-black uppercase tracking-widest">ERP Compliance</h4>
          <p className="text-[11px] text-slate-400 font-medium leading-relaxed">Strict data formatting for direct ingestion: 2DP prices, empty Qty cells for single units, and sanitized strings.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
