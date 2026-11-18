import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import {
  buildGoogleEventResource,
  createCalendarClient,
  getUpcomingEvents,
  insertBatchEvents,
  insertEvent,
} from '../../lib/google-calendar.js';

describe('google-calendar', () => {
  it('should return null from createCalendarClient when env vars are missing or placeholders', () => {
    assert.strictEqual(createCalendarClient({}), null);
    assert.strictEqual(
      createCalendarClient({
        GOOGLE_SERVICE_ACCOUNT_EMAIL: 'YOUR_SERVICE_ACCOUNT_EMAIL',
        GOOGLE_PRIVATE_KEY: 'YOUR_GOOGLE_PRIVATE_KEY',
      }),
      null,
    );
  });

  it('should create Google Calendar client when valid credentials are provided', () => {
    const client = createCalendarClient({
      GOOGLE_SERVICE_ACCOUNT_EMAIL: 'bot@example.iam.gserviceaccount.com',
      GOOGLE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nFAKEKEY\\n-----END PRIVATE KEY-----',
    });
    assert.ok(client);
    assert.ok(client.events);
  });

  it('should build all-day event resource with exclusive end date (+1 day)', () => {
    const resource = buildGoogleEventResource({
      title: '入学式',
      allDay: true,
      date: '2026-04-01',
      description: '講堂にて開催',
    });

    assert.deepEqual(resource, {
      summary: '入学式',
      description: '講堂にて開催',
      start: { date: '2026-04-01' },
      end: { date: '2026-04-02' },
    });
  });

  it('should build timed event resource with default 1 hour duration when endDateTime is omitted', () => {
    const resource = buildGoogleEventResource({
      title: '定例MTG',
      allDay: false,
      startDateTime: '2026-11-15T14:00:00+09:00',
    });

    assert.strictEqual(resource.summary, '定例MTG');
    assert.strictEqual(resource.start.dateTime, '2026-11-15T14:00:00+09:00');
    assert.strictEqual(resource.start.timeZone, 'Asia/Tokyo');
    assert.ok(resource.end.dateTime);
  });

  it('should insert single event using workspace calendar config', async () => {
    const insertMock = mock.fn(async (params) => ({
      data: { id: 'evt_1', summary: params.requestBody.summary, htmlLink: 'https://calendar.google.com/event?eid=1' },
    }));
    const fakeCalendar = { events: { insert: insertMock } };
    const fakePrisma = {
      workspaceCalendarConfig: {
        findUnique: mock.fn(async () => ({
          workspaceId: 'T100',
          googleCalendarId: 'team-cal@group.calendar.google.com',
        })),
      },
    };

    const result = await insertEvent(
      'T100',
      { title: '締め切り', allDay: true, date: '2026-11-20' },
      { calendarClient: fakeCalendar, prismaClient: fakePrisma },
    );

    assert.strictEqual(result.id, 'evt_1');
    assert.strictEqual(insertMock.mock.callCount(), 1);
    assert.strictEqual(insertMock.mock.calls[0].arguments[0].calendarId, 'team-cal@group.calendar.google.com');
  });

  it('should throw friendly error when calendar is not shared (403/404)', async () => {
    const fakeCalendar = {
      events: {
        insert: mock.fn(async () => {
          const err = new Error('Not Found');
          err.code = 404;
          throw err;
        }),
      },
    };
    const fakePrisma = {
      workspaceCalendarConfig: {
        findUnique: mock.fn(async () => ({ workspaceId: 'T100', googleCalendarId: 'missing-cal@gmail.com' })),
      },
    };

    await assert.rejects(
      () =>
        insertEvent(
          'T100',
          { title: 'テスト', allDay: true, date: '2026-11-20' },
          { calendarClient: fakeCalendar, prismaClient: fakePrisma },
        ),
      /サービスアカウントに編集権限で共有されているか/,
    );
  });

  it('should insert batch events and continue even if one item fails', async () => {
    let callIdx = 0;
    const insertMock = mock.fn(async (params) => {
      callIdx += 1;
      if (callIdx === 2) {
        throw new Error('Temporary error');
      }
      return { data: { id: `evt_${callIdx}`, summary: params.requestBody.summary } };
    });
    const fakeCalendar = { events: { insert: insertMock } };
    const fakePrisma = {
      workspaceCalendarConfig: {
        findUnique: mock.fn(async () => ({
          workspaceId: 'T200',
          googleCalendarId: 'yearly@group.calendar.google.com',
        })),
      },
    };

    const summary = await insertBatchEvents(
      'T200',
      [
        { title: '行事A', allDay: true, date: '2026-04-01' },
        { title: '行事B', allDay: true, date: '2026-05-01' },
        { title: '行事C', allDay: true, date: '2026-06-01' },
      ],
      { calendarClient: fakeCalendar, prismaClient: fakePrisma },
    );

    assert.strictEqual(summary.total, 3);
    assert.strictEqual(summary.succeeded, 2);
    assert.strictEqual(summary.failed, 1);
    assert.strictEqual(summary.errors[0].title, '行事B');
  });

  it('should fetch upcoming events for target date in JST', async () => {
    const listMock = mock.fn(async () => ({
      data: {
        items: [{ id: 'e1', summary: '朝礼' }],
      },
    }));
    const fakeCalendar = { events: { list: listMock } };
    const fakePrisma = {
      workspaceCalendarConfig: {
        findUnique: mock.fn(async () => ({ workspaceId: 'T300', googleCalendarId: 'cal300@gmail.com' })),
      },
    };

    const events = await getUpcomingEvents('T300', '2026-11-13T10:00:00+09:00', {
      calendarClient: fakeCalendar,
      prismaClient: fakePrisma,
    });

    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].summary, '朝礼');
    const listArgs = listMock.mock.calls[0].arguments[0];
    assert.strictEqual(listArgs.timeMin, '2026-11-13T00:00:00+09:00');
    assert.strictEqual(listArgs.timeMax, '2026-11-13T23:59:59+09:00');
  });
});
