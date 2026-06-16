// ============================================================
// 화면 이동(네비게이션)을 담당하는 파일입니다.
// - 하단 탭 6개는 TabKey 로 구분합니다.
// - 탭 위에 잠깐 덮어서 보여주는 "세부 화면"(상세/글쓰기 등)은
//   Screen 으로 구분합니다. 뒤로가기로 닫을 수 있어요.
// ============================================================
import {createContext, useContext} from 'react';
import type {BoardType} from './types';

// 하단 탭 종류
export type TabKey = 'home' | 'community' | 'meetup' | 'market' | 'chat' | 'profile';

// 세부 화면 종류 (탭 위에 덮어서 표시됨)
export type Screen =
  | {name: 'postDetail'; id: number} // 글 상세보기
  | {name: 'postForm'; id?: number; board?: BoardType} // 글쓰기/수정 (id 있으면 수정)
  | {name: 'meetupDetail'; id: number} // 모임 상세
  | {name: 'meetupForm'; id?: number} // 모임 만들기/수정
  | {name: 'meetupBoard'; id: number} // 모임 게시판 (공지/게시글)
  | {name: 'meetupChat'; id: number} // 모임 단체 채팅
  | {name: 'meetupGreetings'; id: number} // 모임 가입 인사
  | {name: 'marketDetail'; id: number} // 상품 상세
  | {name: 'marketForm'; id?: number} // 상품 등록/수정
  | {name: 'chatRoom'; id: number} // 채팅방
  | {name: 'chatNew'} // 목적 채팅방 개설
  | {name: 'profileEdit'} // 프로필 수정
  | {name: 'users'} // 회원 관리 목록
  | {name: 'userForm'; id?: number} // 회원 추가/수정
  | {name: 'inquiry'} // 문의하기 (회원)
  | {name: 'adminVerifications'} // 졸업 인증 요청 (관리자)
  | {name: 'adminInquiries'} // 문의 확인 (관리자)
  | {name: 'adminReports'} // 신고 확인 (관리자)
  | {name: 'verify'} // 졸업증명서 인증
  | {name: 'notifications'} // 알림
  | {name: 'notes'} // 쪽지함 (대화 상대 목록)
  | {name: 'noteThread'; with: string} // 특정 상대와의 쪽지 대화 (익명이면 목록)
  | {name: 'noteSend'; to: string}; // 쪽지 보내기 (to = 받는 사람)

// 화면 이동에 쓰는 함수 묶음
export interface Nav {
  push: (screen: Screen) => void; // 세부 화면 열기
  pop: () => void; // 뒤로가기
  goTab: (tab: TabKey) => void; // 특정 탭으로 이동
}

// 어느 화면에서든 nav 를 꺼내 쓸 수 있도록 Context 로 제공합니다.
export const NavContext = createContext<Nav | null>(null);

// 화면 컴포넌트에서 const nav = useNav(); 처럼 사용합니다.
export function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error('NavContext 안에서만 useNav 를 쓸 수 있어요.');
  return nav;
}
