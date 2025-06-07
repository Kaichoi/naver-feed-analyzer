import { NextResponse } from 'next/server'
import { NaverFeedCrawler, type FeedItem, type CrawlProgress } from '@/lib/crawler'
import { NextRequest } from 'next/server'

interface StreamResponse {
  type: 'progress' | 'item' | 'complete' | 'error'
  data: CrawlProgress | FeedItem | { message: string }
}

// CORS 헤더 설정
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

// OPTIONS 요청 처리 (CORS preflight)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  })
}

// GET 요청도 지원 (테스트용)
export async function GET() {
  // 스트림 상태 추적을 위한 플래그
  let isStreamClosed = false

  // 안전한 메시지 전송 함수
  const safeSend = (controller: ReadableStreamDefaultController, message: string) => {
    if (!isStreamClosed) {
      try {
        controller.enqueue(`data: ${message}\n\n`)
      } catch (error: unknown) {
        console.log('스트림이 이미 닫혔습니다:', error)
        isStreamClosed = true
      }
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const crawler = new NaverFeedCrawler()
      let totalItems = 0
      
      try {
        const crawlGenerator = crawler.crawlAll((progress: CrawlProgress) => {
          if (isStreamClosed) return
          
          const message: StreamResponse = {
            type: 'progress',
            data: progress
          }
          safeSend(controller, JSON.stringify(message))
        })

        for await (const items of crawlGenerator) {
          if (isStreamClosed) return
          
          // 각 아이템을 개별적으로 전송
          for (const item of items) {
            totalItems++
            const message: StreamResponse = {
              type: 'item',
              data: item
            }
            safeSend(controller, JSON.stringify(message))
          }
        }

        if (!isStreamClosed) {
          const completeMessage: StreamResponse = {
            type: 'complete',
            data: {
              currentPage: 15,
              totalPages: 15,
              itemsFound: totalItems,
              status: 'completed'
            }
          }
          safeSend(controller, JSON.stringify(completeMessage))
          controller.close()
        }
        
      } catch (error: unknown) {
        if (isStreamClosed) return
        
        const errorMessage: StreamResponse = {
          type: 'error',
          data: { message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.' }
        }
        safeSend(controller, JSON.stringify(errorMessage))
        controller.close()
      }
    },
    cancel() {
      // 클라이언트가 연결을 끊었을 때
      isStreamClosed = true
      console.log('클라이언트가 스트림 연결을 끊었습니다.')
    }
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, page = 1, nextCursor, adAfterCardsCount, adNextSeq } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    const url = `https://m.naver.com/nvhaproxy_craft/v1/homefeed/mainHomefeed/1/feeds`
    const params = new URLSearchParams({
      sessionId,
      page: page.toString(),
    })

    // NextCursor 파라미터들 추가 (파이썬과 동일)
    if (nextCursor) params.append('nextCursor', nextCursor)
    if (adAfterCardsCount) params.append('adAfterCardsCount', adAfterCardsCount.toString())
    if (adNextSeq) params.append('adNextSeq', adNextSeq.toString())

    const response = await fetch(`${url}?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Referer': 'https://m.naver.com/',
      },
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch from Naver API' }, { status: response.status })
    }

    const data = await response.json()
    
    // NextCursor 파라미터 추출
    const pageInfo = data?.pageInfo || {}
    const nextCursorResponse = pageInfo.nextCursor
    const adAfterCardsCountResponse = pageInfo.adAfterCardsCount
    const adNextSeqResponse = pageInfo.adNextSeq
    
    // 데이터 처리
    const cards = data?.cards || []
    const items = []

    for (const card of cards) {
      if (card.code !== 'searchFeed') continue
      
      const contents = card.contents
      const item = contents?.item
      const bypass = contents?.byPass
      
      if (!item || !bypass) continue
      
      const title = item.title
      const url = item.url
      let service = bypass.service
      
      if (!title || !url || !service) continue
      
      // 인플루언서 콘텐츠 처리 (파이썬과 동일한 패턴)
      if (/https:\/\/in\.naver\.com\/[^/]+\/contents\/internal\/\d+/.test(url)) {
        service = "INFL"
      }
      
      items.push({
        id: `${page}-${Math.random().toString(36).substr(2, 9)}`,
        title,
        url,
        service,
        created_at: new Date().toISOString()
      })
    }

    return NextResponse.json({ 
      items,
      totalCards: cards.length,
      hasMore: cards.length > 0,
      // NextCursor 파라미터들 응답에 포함
      nextCursor: nextCursorResponse,
      adAfterCardsCount: adAfterCardsCountResponse,
      adNextSeq: adNextSeqResponse
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 