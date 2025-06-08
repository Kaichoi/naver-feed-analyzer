import { NextResponse } from 'next/server'
import { NaverFeedCrawler, type FeedItem, type CrawlProgress } from '@/lib/crawler'
import { NextRequest } from 'next/server'

interface StreamResponse {
  type: 'progress' | 'item' | 'complete' | 'error'
  data: CrawlProgress | FeedItem | { message: string; totalItems?: number }
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

export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json()

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
    }

    console.log('=== 스트리밍 크롤링 시작 ===', { jobId })

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
          // 크롤링 시작 메시지
          safeSend(controller, JSON.stringify({
            type: 'progress',
            data: {
              currentPage: 0,
              totalPages: 15,
              itemsFound: 0,
              status: 'running',
              message: '크롤링 시작...'
            }
          }))

          const crawlGenerator = crawler.crawlAll((progress: CrawlProgress) => {
            if (isStreamClosed) return
            
            const message: StreamResponse = {
              type: 'progress',
              data: progress
            }
            safeSend(controller, JSON.stringify(message))
          })

          // 비동기 제너레이터로부터 데이터 수집
          for await (const newItems of crawlGenerator) {
            if (isStreamClosed) return
            
            // 각 아이템을 개별적으로 전송 (Python 버전과 동일)
            for (const item of newItems) {
              totalItems++
              const message: StreamResponse = {
                type: 'item',
                data: item
              }
              safeSend(controller, JSON.stringify(message))
            }
          }

          if (!isStreamClosed) {
            // 완료 메시지 전송 (Python 버전과 동일한 형식)
            const completeMessage: StreamResponse = {
              type: 'complete',
              data: {
                message: `총 ${totalItems}개 항목 수집 완료 (중복 제거됨)`,
                totalItems: totalItems
              }
            }
            safeSend(controller, JSON.stringify(completeMessage))
            controller.close()
          }
          
        } catch (error: unknown) {
          if (isStreamClosed) return
          
          console.error('크롤링 중 오류:', error)
          const errorMessage: StreamResponse = {
            type: 'error',
            data: { 
              message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.' 
            }
          }
          safeSend(controller, JSON.stringify(errorMessage))
          
          try {
            controller.close()
          } catch (closeError) {
            console.error('스트림 닫기 오류:', closeError)
          }
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