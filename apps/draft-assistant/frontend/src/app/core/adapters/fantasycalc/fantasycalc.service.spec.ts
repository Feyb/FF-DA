/// <reference types="jasmine" />

import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { FantasyCalcService } from "./fantasycalc.service";
import { FantasyCalcPlayer } from "../../models";

const FIXTURE: FantasyCalcPlayer[] = [
  {
    playerName: "Ja'Marr Chase",
    sleeperId: "6794",
    position: "WR",
    value: 9821,
    overallRank: 1,
    positionRank: 1,
    trend30Day: 124,
    redraftValue: 4023,
    combinedValue: 13844,
    stdev: 312,
  },
  {
    playerName: "Justin Jefferson",
    sleeperId: "6786",
    position: "WR",
    value: 9402,
    overallRank: 2,
    positionRank: 2,
    trend30Day: -45,
    redraftValue: 3922,
    combinedValue: 13324,
    stdev: 287,
  },
];

describe("FantasyCalcService", () => {
  let service: FantasyCalcService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FantasyCalcService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it("loads players for the requested format and caches the observable", (done) => {
    service.getValues("1qb-dynasty").subscribe((players) => {
      expect(players.length).toBe(2);
      expect(players[0].playerName).toBe("Ja'Marr Chase");

      // Second call should not trigger a new HTTP request.
      service.getValues("1qb-dynasty").subscribe((players2) => {
        expect(players2).toBe(players);
        done();
      });
    });

    const req = http.expectOne("assets/fantasycalc/values-1qb-dynasty.json");
    expect(req.request.method).toBe("GET");
    req.flush(FIXTURE);
  });

  it("returns empty array on HTTP error", (done) => {
    service.getValues("superflex-redraft").subscribe((players) => {
      expect(players).toEqual([]);
      done();
    });

    http
      .expectOne("assets/fantasycalc/values-superflex-redraft.json")
      .error(new ProgressEvent("error"));
  });

  it("builds name and sleeperId lookups", () => {
    const byName = service.buildNameLookup(FIXTURE);
    expect(byName.get(service.normalizeName("Ja'Marr Chase"))?.value).toBe(9821);

    const bySleeper = service.buildSleeperIdLookup(FIXTURE);
    expect(bySleeper.get("6786")?.playerName).toBe("Justin Jefferson");
  });
});
