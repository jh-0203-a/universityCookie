// ============================================================
// 중고거래 관련 화면 모음입니다.
//  - MarketScreen : 상품 목록
//  - MarketDetail : 상품 상세 (상태 / 수정 / 삭제 / 채팅)
//  - MarketForm   : 상품 등록 / 수정
// ============================================================
import {useState} from 'react';
import {useStore} from './data';
import {useNav} from './nav';
import {CommentThread} from './Comments';
import type {MarketItem} from './types';
import {DangerButton, Empty, Field, GhostButton, ImageLightbox, ImagePicker, Page, PrimaryButton, ReportModal, inputClass} from './ui';

const STATUSES: MarketItem['status'][] = ['판매중', '예약중', '판매완료'];

// 가격을 "12,000원" 형태로
function won(price: number) {
  return price.toLocaleString('ko-KR') + '원';
}

// ----- 상품 목록 -----
export function MarketScreen() {
  const {items} = useStore();
  const nav = useNav();

  if (items.length === 0) return <Empty text="등록된 상품이 없어요. + 버튼으로 상품을 올려보세요!" />;

  return (
    <div className="space-y-3 p-4">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => nav.push({name: 'marketDetail', id: item.id})}
          className="flex w-full gap-3 rounded-xl bg-white p-3 text-left shadow-sm active:bg-gray-50"
        >
          {item.image ? (
            <img src={item.image} alt={item.title} className="h-20 w-20 flex-none rounded-lg object-cover" />
          ) : (
            // 사진이 없으면 빈 박스만 보여줍니다.
            <div className="h-20 w-20 flex-none rounded-lg bg-gray-100" />
          )}
          <div className="flex flex-col justify-between">
            <div>
              <h2 className="font-medium text-gray-900">{item.title}</h2>
              <p className="text-xs text-gray-400">{item.place}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900">{won(item.price)}</span>
              <StatusTag status={item.status} />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function StatusTag({status}: {status: MarketItem['status']}) {
  const color =
    status === '판매중' ? 'bg-green-100 text-green-600' : status === '예약중' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500';
  return <span className={`rounded px-1.5 py-0.5 text-xs ${color}`}>{status}</span>;
}

// ----- 상품 상세 -----
export function MarketDetail({id}: {id: number}) {
  const {items, me, deleteItem, openDirectRoom, addReport, addItemComment, deleteItemComment} = useStore();
  const nav = useNav();
  const [reporting, setReporting] = useState(false); // 신고 모달 열림 여부
  const [zoom, setZoom] = useState(false); // 사진 확대(라이트박스) 열림 여부
  const item = items.find((x) => x.id === id);
  const isMine = item?.seller === me.nickname; // 내가 올린 상품인지

  if (!item) {
    return (
      <Page title="상품" onBack={nav.pop}>
        <Empty text="삭제되었거나 없는 상품이에요." />
      </Page>
    );
  }

  function handleDelete() {
    if (window.confirm('이 상품을 삭제할까요?')) {
      deleteItem(id);
      nav.pop();
    }
  }

  // 판매자와의 1:1 채팅방을 열고(없으면 만들고) 그 방으로 바로 들어갑니다.
  async function handleChat() {
    if (!item) return;
    const roomId = await openDirectRoom(`${item.title} 거래`, item.seller ?? '판매자');
    nav.push({name: 'chatRoom', id: roomId});
  }

  return (
    <Page
      title="상품 상세"
      onBack={nav.pop}
      footer={
        // 내가 올린 상품이면 채팅 버튼을 숨깁니다.
        isMine ? undefined : (
          <PrimaryButton full onClick={handleChat}>
            판매자와 채팅하기
          </PrimaryButton>
        )
      }
    >
      {item.image ? (
        // 사진을 누르면 전체 화면으로 크게 볼 수 있어요.
        <button type="button" onClick={() => setZoom(true)} className="block w-full" aria-label="사진 크게 보기">
          <img src={item.image} alt={item.title} className="h-48 w-full cursor-zoom-in object-cover" />
        </button>
      ) : (
        // 사진이 없으면 빈 박스만 보여줍니다.
        <div className="h-48 bg-gray-100" />
      )}
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-gray-900">{item.title}</h2>
          <StatusTag status={item.status} />
        </div>
        <p className="text-2xl font-bold text-orange-500">{won(item.price)}</p>
        <p className="text-sm text-gray-500">
          거래 희망 장소 : <span className="text-gray-700">{item.place || '미정'}</span>
        </p>
        <p className="whitespace-pre-wrap text-gray-700">{item.body}</p>
        {/* 내 상품이면 수정/삭제, 남의 상품이면 신고 */}
        {isMine ? (
          <div className="flex gap-2">
            <GhostButton onClick={() => nav.push({name: 'marketForm', id})}>수정</GhostButton>
            <DangerButton onClick={handleDelete}>삭제</DangerButton>
          </div>
        ) : (
          <button onClick={() => setReporting(true)} className="text-sm text-red-500">
            🚨 신고하기
          </button>
        )}

        {/* 댓글 + 대댓글(답글) */}
        <div className="border-t border-gray-100 pt-4">
          <CommentThread
            comments={item.comments}
            meNick={me.nickname}
            isAdmin={me.role === '관리자'}
            onAdd={(body, parentId) => addItemComment(id, body, parentId)}
            onDelete={(cid) => deleteItemComment(id, cid)}
          />
        </div>
      </div>

      {/* 신고 모달 */}
      {reporting && (
        <ReportModal
          who={item.seller}
          onClose={() => setReporting(false)}
          onSubmit={(reason) => {
            addReport('상품', item.title, reason, item.seller, item.id);
            window.alert('신고가 접수되었어요. 관리자 확인 후 조치하겠습니다.');
          }}
        />
      )}

      {/* 사진 확대 보기 */}
      <ImageLightbox src={zoom ? item.image : undefined} onClose={() => setZoom(false)} />
    </Page>
  );
}

// ----- 상품 등록 / 수정 -----
export function MarketForm({id}: {id?: number}) {
  const {items, addItem, updateItem} = useStore();
  const {me} = useStore();
  const nav = useNav();
  const editing = items.find((x) => x.id === id);

  const [title, setTitle] = useState(editing?.title ?? '');
  const [price, setPrice] = useState(String(editing?.price ?? ''));
  const [place, setPlace] = useState(editing?.place ?? me.school);
  const [status, setStatus] = useState<MarketItem['status']>(editing?.status ?? '판매중');
  const [body, setBody] = useState(editing?.body ?? '');
  const [image, setImage] = useState(editing?.image);

  function handleSave() {
    if (!title.trim()) {
      window.alert('상품 이름을 입력해 주세요.');
      return;
    }
    const p = Number(price) || 0;
    if (editing) {
      updateItem(editing.id, {title, price: p, place, status, body, image});
    } else {
      addItem({title, price: p, place, status, body, image});
    }
    nav.pop();
  }

  return (
    <Page
      title={editing ? '상품 수정' : '상품 등록'}
      onBack={nav.pop}
      footer={
        <PrimaryButton full onClick={handleSave}>
          {editing ? '수정 완료' : '등록하기'}
        </PrimaryButton>
      }
    >
      <div className="space-y-4 p-4">
        <ImagePicker label="상품 사진" value={image} onChange={setImage} />
        <Field label="상품 이름">
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 전공 교재 팝니다" />
        </Field>
        <Field label="가격 (원)">
          <input className={inputClass} type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" min={0} />
        </Field>
        <Field label="거래 장소">
          <input className={inputClass} value={place} onChange={(e) => setPlace(e.target.value)} placeholder="예: 성균관대" />
        </Field>
        <Field label="상태">
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as MarketItem['status'])}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="설명">
          <textarea
            className={`${inputClass} h-32 resize-none`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="상품 설명을 입력하세요"
          />
        </Field>
      </div>
    </Page>
  );
}
