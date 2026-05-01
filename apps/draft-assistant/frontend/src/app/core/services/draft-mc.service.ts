import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import type { McSimRequest, McSimResult } from "../workers/draft-mc.worker";

export type { McSimRequest, McSimResult } from "../workers/draft-mc.worker";

/**
 * Manages the Monte Carlo simulation Web Worker for draft tie-break analysis.
 * Each call to runSimulation() terminates any in-progress simulation and starts
 * a fresh one, so the caller should debounce/switchMap as needed.
 */
@Injectable({ providedIn: "root" })
export class DraftMcService {
  private worker: Worker | null = null;

  runSimulation(req: McSimRequest): Observable<McSimResult> {
    return new Observable<McSimResult>((observer) => {
      this.worker?.terminate();

      let workerInstance: Worker;
      try {
        workerInstance = new Worker(new URL("../workers/draft-mc.worker", import.meta.url), {
          type: "module",
        });
      } catch {
        observer.next({ confidence: [] });
        observer.complete();
        return;
      }

      this.worker = workerInstance;

      workerInstance.onmessage = (event: MessageEvent<McSimResult>) => {
        observer.next(event.data);
        observer.complete();
        this.worker = null;
      };

      workerInstance.onerror = () => {
        observer.next({ confidence: [] });
        observer.complete();
        this.worker = null;
      };

      workerInstance.postMessage(req);

      return () => {
        workerInstance.terminate();
        if (this.worker === workerInstance) this.worker = null;
      };
    });
  }
}
