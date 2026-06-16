// ============================================================
// 알림 화면입니다.
//  - 지금 로그인한 사람에게 온 알림만 보여줍니다.
//  - 알림을 누르면 해당 글/쪽지로 이동하고 읽음 처리됩니다.
// ============================================================
import {useStore} from './data';
import {useNav} from './nav';
import {Empty, Page} from './ui';

export function NotificationsScreen() {
  const {notifications, me, markNotificationRead, markAllNotificationsRead} = useStore();
  const nav = useNav();
  const mine = (notifications ?? []).filter((n) => n.toUser === me.nickname);

  function open(n: (typeof mine)[number]) {
    markNotificationRead(n.id);
    if (n.postId != null) nav.push({name: 'postDetail', id: n.postId});
    else if (n.noteWith) nav.push({name: 'noteThread', with: n.noteWith});
  }

  return (
    <Page
      title="알림"
      onBack={nav.pop}
      headerRight={
        mine.some((n) => !n.read) ? (
          <button onClick={markAllNotificationsRead} className="text-sm text-gray-500">
            모두 읽음
          </button>
        ) : undefined
      }
    >
      {mine.length === 0 ? (
        <Empty text="알림이 없어요." />
      ) : (
        <div className="overflow-hidden">
          {mine.map((n) => (
            <button
              key={n.id}
              onClick={() => open(n)}
              className={`flex w-full items-start gap-2 border-b border-gray-100 px-4 py-3 text-left transition-colors active:bg-gray-100 ${
                n.read ? 'bg-white hover:bg-gray-50' : 'bg-orange-50 hover:bg-orange-100'
              }`}
            >
              {!n.read && <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-orange-500" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-800">{n.message}</p>
                <p className="mt-0.5 text-xs text-gray-400">{n.createdAt}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </Page>
  );
}
