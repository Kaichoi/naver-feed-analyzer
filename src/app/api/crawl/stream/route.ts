import { NextResponse, NextRequest } from 'next/server'

// parse.py와 동일한 크롤링 로직을 구현
interface CrawlItem {
  id: string
  title: string
  url: string
  service: string
  created_at: string
}

interface PageInfo {
  nextCursor?: string
  adAfterCardsCount?: number
  adNextSeq?: number
}

// parse.py의 fetch_page 함수와 동일
async function fetchPage(
  page: number, 
  sessionId: string, 
  nextCursor?: string, 
  adAfterCardsCount?: number, 
  adNextSeq?: number
) {
  const baseUrl = "https://m.naver.com/nvhaproxy_craft/v1/homefeed/mainHomefeed/1/feeds"
  const params = new URLSearchParams({
    sessionId,
    page: page.toString(),
  })
  
  if (nextCursor !== undefined) params.append("nextCursor", nextCursor)
  if (adAfterCardsCount !== undefined) params.append("adAfterCardsCount", adAfterCardsCount.toString())
  if (adNextSeq !== undefined) params.append("adNextSeq", adNextSeq.toString())

  const headers = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    "Referer": "https://m.naver.com/",
  }

  const response = await fetch(`${baseUrl}?${params}`, { headers })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  return response.json()
}

// parse.py의 extract_items_from_page 함수와 동일
function extractItemsFromPage(data: any): CrawlItem[] {
  const items: CrawlItem[] = []
  const cards = data.cards || []

  for (const card of cards) {
    // 'code'가 "searchFeed"인 카드만 콘텐츠로 간주
    if (card.code !== "searchFeed") continue

    const contents = card.contents || {}
    const item = contents.item
    const bypass = contents.byPass

    // item과 byPass가 제대로 있어야만 추출
    if (!item || !bypass) continue

    const title = item.title
    const url = item.url
    let service = bypass.service

    // 이 세 가지 값이 모두 있어야만 최종 추가
    if (title && url && service) {
      // URL 패턴 확인하여 인플루언서 콘텐츠인지 판단
      if (/^https:\/\/in\.naver\.com\/[^/]+\/contents\/internal\/\d+/.test(url)) {
        service = "INFL"
      }
      
      items.push({
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title,
        url,
        service,
        created_at: new Date().toISOString()
      })
    }
  }

  return items
}

// CORS 헤더 설정
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  })
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, maxPages = 15, delay = 1500 } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    console.log('=== 스트리밍 크롤링 시작 ===', { sessionId, maxPages, delay })

    // 스트림 상태 추적
    let isStreamClosed = false

    // 안전한 메시지 전송 함수
    const safeSend = (controller: ReadableStreamDefaultController, message: string) => {
      if (!isStreamClosed) {
        try {
          controller.enqueue(`${message}\n`)
        } catch (error) {
          console.log('스트림이 이미 닫혔습니다:', error)
          isStreamClosed = true
        }
      }
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // parse.py와 동일한 크롤링 로직
          let allResults: CrawlItem[] = []
          let nextCursor: string | undefined
          let adAfterCardsCount: number | undefined
          let adNextSeq: number | undefined

          for (let page = 1; page <= maxPages; page++) {
            if (isStreamClosed) return

            // 진행률 전송
            const progress = (page / maxPages) * 100
            safeSend(controller, JSON.stringify({
              type: 'progress',
              progress,
              currentPage: page
            }))

            try {
              console.log(`Fetching page ${page}...`)
              
              const data = await fetchPage(
                page,
                sessionId,
                nextCursor,
                adAfterCardsCount,
                adNextSeq
              )

              // 다음 페이지용 파라미터 업데이트
              const pageInfo = data.pageInfo || {}
              nextCursor = pageInfo.nextCursor
              adAfterCardsCount = pageInfo.adAfterCardsCount
              adNextSeq = pageInfo.adNextSeq

              const pageItems = extractItemsFromPage(data)

              // 한 페이지에서 아무것도 추출하지 못했으면 중단
              if (pageItems.length === 0) {
                console.log(`No items found on page ${page}, stopping...`)
                break
              }

              // 모든 결과에 추가
              allResults.push(...pageItems)

              // 현재까지의 결과를 중복 제거하여 전송
              const uniqueResults: CrawlItem[] = []
              const seenUrls = new Set<string>()
              
              for (const item of allResults) {
                if (!seenUrls.has(item.url)) {
                  seenUrls.add(item.url)
                  uniqueResults.push(item)
                }
              }

              // 중복 제거된 결과 전송
              safeSend(controller, JSON.stringify({
                type: 'items',
                items: uniqueResults
              }))

              // 딜레이 적용 (마지막 페이지가 아닌 경우)
              if (page < maxPages) {
                await new Promise(resolve => setTimeout(resolve, delay))
              }

            } catch (error) {
              console.error(`Error on page ${page}:`, error)
              break
            }
          }

          // 최종 중복 제거
          const finalResults: CrawlItem[] = []
          const seenUrls = new Set<string>()
          
          for (const item of allResults) {
            if (!seenUrls.has(item.url)) {
              seenUrls.add(item.url)
              finalResults.push(item)
            }
          }

          if (!isStreamClosed) {
            // 완료 메시지 전송
            safeSend(controller, JSON.stringify({
              type: 'complete',
              totalItems: finalResults.length,
              message: `총 ${finalResults.length}개 항목 수집 완료 (중복 제거됨)`
            }))
            controller.close()
          }
          
        } catch (error: unknown) {
          if (isStreamClosed) return
          
          console.error('크롤링 중 오류:', error)
          safeSend(controller, JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
          }))
          
          try {
            controller.close()
          } catch (closeError) {
            console.error('스트림 닫기 오류:', closeError)
          }
        }
      },
      cancel() {
        isStreamClosed = true
        console.log('클라이언트가 스트림 연결을 끊었습니다.')
      }
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...getCorsHeaders(),
      },
    })

  } catch (error) {
    console.error('스트리밍 API 오류:', error)
    return NextResponse.json({ 
      error: '스트리밍 크롤링 초기화 실패',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 