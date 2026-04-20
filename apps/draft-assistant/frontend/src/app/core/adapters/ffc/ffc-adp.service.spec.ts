/// <reference types="jasmine" />

import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { FfcAdpService } from "./ffc-adp.service";
import { FfcAdpPlayer } from "../../models";

const FIXTURE: FfcAdpPlayer[] = [
  {
    playerName: "Ja'Marr Chase",
    position: "WR",
    team: "CIN",
    adp: 1.4,
    adpFormatted: "1.04",
    stdev: 0.6,
    high: 1,
    low: 4,
    timesDrafted: 312,
    bye: 12,
  },
  {
    playerName: "Bijan Robinson",
    position: "RB",
    team: "ATL",
    adp: 2.8,
    adpFormatted: "1.07",
    stdev: 1.2,
    high: 1,
    low: 8,
    timesDrafted: 311,
    bye: 5,
  },
];

describe("FfcAdpService", () => {
  let service: FfcAdpService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FfcAdpService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it("fetches per-format ADP and caches the result", (done) => {
    service.getAdp("half-ppr").subscribe((players) => {
      expect(players[0].playerName).toBe("Ja'Marr Chase");
      expect(players[0].stdev).toBe(0.6);

      service.getAdp("half-ppr").subscribe((players2) => {
        expect(players2).toBe(players);
        done();
      });
    });

    const req = http.expectOne("assets/ffc/adp-half-ppr-12team.json");
    req.flush(FIXTURE);
  });

  it("returns empty array on error", (done) => {
    service.getAdp("dynasty").subscribe((players) => {
      expect(players).toEqual([]);
      done();
    });
    http.expectOne("assets/ffc/adp-dynasty-12team.json").error(new ProgressEvent("error"));
  });

  it("builds a normalized name lookup", () => {
    const lookup = service.buildNameLookup(FIXTURE);
    expect(lookup.get(service.normalizeName("Bijan Robinson"))?.adp).toBe(2.8);
  });
});
