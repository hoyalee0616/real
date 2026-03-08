<?php
/**
 * Plugin Name: Toss Finance Auto Poster
 * Description: Import finance-related posts from Toss Feed, rewrite tone, and auto-post to WordPress.
 * Version: 0.2.0
 * Author: Codex
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

class Toss_Finance_Autoposter {
    const OPTION_KEY = 'toss_finance_ap_settings';
    const CRON_HOOK = 'toss_finance_ap_run_import';
    const NONCE_ACTION = 'toss_finance_ap_manual_run';

    public function __construct() {
        add_action('admin_menu', array($this, 'register_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action(self::CRON_HOOK, array($this, 'run_import_job'));
        add_action('admin_post_toss_finance_ap_manual_run', array($this, 'handle_manual_run'));

        register_activation_hook(__FILE__, array($this, 'on_activate'));
        register_deactivation_hook(__FILE__, array($this, 'on_deactivate'));
    }

    public function on_activate() {
        $finance_cat_id = $this->ensure_finance_category();
        $settings = $this->get_settings();
        if (intval($settings['target_category']) === 0 && $finance_cat_id > 0) {
            $settings['target_category'] = $finance_cat_id;
            update_option(self::OPTION_KEY, $settings);
        }

        if (!wp_next_scheduled(self::CRON_HOOK)) {
            wp_schedule_event(time() + 120, 'hourly', self::CRON_HOOK);
        }
    }

    public function on_deactivate() {
        wp_clear_scheduled_hook(self::CRON_HOOK);
    }

    public function default_settings() {
        return array(
            'feed_url' => 'https://toss.im/tossfeed/feed/',
            'source_page_url' => 'https://toss.im/tossfeed/',
            'finance_keywords' => '금융,은행,대출,예금,적금,카드,신용카드,체크카드,투자,주식,채권,ETF,연금,세금,환율,보험,금리,증권,자산,가계부,송금,결제,경제,재테크',
            'post_status' => 'draft',
            'post_author' => 1,
            'target_category' => 0,
            'items_per_run' => 2,
            'title_prefix' => '',
            'include_source_link' => 1,
            'openai_enabled' => 0,
            'openai_api_key' => '',
            'openai_model' => 'gpt-4o-mini',
        );
    }

    public function get_settings() {
        $saved = get_option(self::OPTION_KEY, array());
        return wp_parse_args($saved, $this->default_settings());
    }

    public function register_admin_menu() {
        add_options_page(
            'Toss Finance Auto Poster',
            'Toss Finance Auto Poster',
            'manage_options',
            'toss-finance-autoposter',
            array($this, 'render_settings_page')
        );
    }

    public function register_settings() {
        register_setting(
            'toss_finance_ap_settings_group',
            self::OPTION_KEY,
            array($this, 'sanitize_settings')
        );
    }

    public function sanitize_settings($input) {
        $defaults = $this->default_settings();

        return array(
            'feed_url' => esc_url_raw($input['feed_url'] ?? $defaults['feed_url']),
            'source_page_url' => esc_url_raw($input['source_page_url'] ?? $defaults['source_page_url']),
            'finance_keywords' => sanitize_text_field($input['finance_keywords'] ?? $defaults['finance_keywords']),
            'post_status' => in_array($input['post_status'] ?? 'draft', array('draft', 'publish'), true) ? $input['post_status'] : 'draft',
            'post_author' => max(1, intval($input['post_author'] ?? 1)),
            'target_category' => max(0, intval($input['target_category'] ?? 0)),
            'items_per_run' => min(10, max(1, intval($input['items_per_run'] ?? 2))),
            'title_prefix' => sanitize_text_field($input['title_prefix'] ?? ''),
            'include_source_link' => !empty($input['include_source_link']) ? 1 : 0,
            'openai_enabled' => !empty($input['openai_enabled']) ? 1 : 0,
            'openai_api_key' => sanitize_text_field($input['openai_api_key'] ?? ''),
            'openai_model' => sanitize_text_field($input['openai_model'] ?? $defaults['openai_model']),
        );
    }

    private function ensure_finance_category() {
        $term = get_term_by('name', '금융', 'category');
        if ($term && !is_wp_error($term)) {
            return intval($term->term_id);
        }

        $created = wp_insert_term('금융', 'category', array('slug' => 'finance'));
        if (is_wp_error($created)) {
            return 0;
        }

        return intval($created['term_id']);
    }

    public function render_settings_page() {
        if (!current_user_can('manage_options')) {
            return;
        }

        $settings = $this->get_settings();
        $authors = get_users(array('who' => 'authors'));
        $categories = get_categories(array('hide_empty' => false));
        ?>
        <div class="wrap">
            <h1>Toss Finance Auto Poster</h1>
            <p>Toss Feed에서 금융 관련 글만 가져와 요약/톤 변환 후 자동 발행합니다.</p>

            <form method="post" action="options.php">
                <?php settings_fields('toss_finance_ap_settings_group'); ?>
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row"><label for="feed_url">피드 URL</label></th>
                        <td><input type="url" class="regular-text" id="feed_url" name="<?php echo esc_attr(self::OPTION_KEY); ?>[feed_url]" value="<?php echo esc_attr($settings['feed_url']); ?>" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="source_page_url">소스 페이지 URL(피드 실패 시)</label></th>
                        <td><input type="url" class="regular-text" id="source_page_url" name="<?php echo esc_attr(self::OPTION_KEY); ?>[source_page_url]" value="<?php echo esc_attr($settings['source_page_url']); ?>" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="finance_keywords">금융 키워드(쉼표 구분)</label></th>
                        <td><input type="text" class="regular-text" id="finance_keywords" name="<?php echo esc_attr(self::OPTION_KEY); ?>[finance_keywords]" value="<?php echo esc_attr($settings['finance_keywords']); ?>" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="post_status">게시 상태</label></th>
                        <td>
                            <select id="post_status" name="<?php echo esc_attr(self::OPTION_KEY); ?>[post_status]">
                                <option value="draft" <?php selected($settings['post_status'], 'draft'); ?>>임시글</option>
                                <option value="publish" <?php selected($settings['post_status'], 'publish'); ?>>즉시게시</option>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="post_author">작성자</label></th>
                        <td>
                            <select id="post_author" name="<?php echo esc_attr(self::OPTION_KEY); ?>[post_author]">
                                <?php foreach ($authors as $author) : ?>
                                    <option value="<?php echo esc_attr($author->ID); ?>" <?php selected(intval($settings['post_author']), intval($author->ID)); ?>>
                                        <?php echo esc_html($author->display_name); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="target_category">기본 카테고리</label></th>
                        <td>
                            <select id="target_category" name="<?php echo esc_attr(self::OPTION_KEY); ?>[target_category]">
                                <option value="0">자동(금융)</option>
                                <?php foreach ($categories as $cat) : ?>
                                    <option value="<?php echo esc_attr($cat->term_id); ?>" <?php selected(intval($settings['target_category']), intval($cat->term_id)); ?>>
                                        <?php echo esc_html($cat->name); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="items_per_run">1회 처리 개수</label></th>
                        <td><input type="number" min="1" max="10" id="items_per_run" name="<?php echo esc_attr(self::OPTION_KEY); ?>[items_per_run]" value="<?php echo esc_attr($settings['items_per_run']); ?>" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="title_prefix">제목 접두사(미사용 권장)</label></th>
                        <td><input type="text" id="title_prefix" name="<?php echo esc_attr(self::OPTION_KEY); ?>[title_prefix]" value="<?php echo esc_attr($settings['title_prefix']); ?>" /></td>
                    </tr>
                    <tr>
                        <th scope="row">출처 링크 표시</th>
                        <td>
                            <label>
                                <input type="checkbox" name="<?php echo esc_attr(self::OPTION_KEY); ?>[include_source_link]" value="1" <?php checked(intval($settings['include_source_link']), 1); ?> />
                                본문 하단에 원문 링크 추가
                            </label>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">OpenAI 리라이팅 사용</th>
                        <td>
                            <label>
                                <input type="checkbox" name="<?php echo esc_attr(self::OPTION_KEY); ?>[openai_enabled]" value="1" <?php checked(intval($settings['openai_enabled']), 1); ?> />
                                OpenAI API로 제목/본문 톤 재구성
                            </label>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="openai_api_key">OpenAI API Key</label></th>
                        <td><input type="password" class="regular-text" id="openai_api_key" name="<?php echo esc_attr(self::OPTION_KEY); ?>[openai_api_key]" value="<?php echo esc_attr($settings['openai_api_key']); ?>" autocomplete="off" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="openai_model">OpenAI 모델</label></th>
                        <td><input type="text" id="openai_model" name="<?php echo esc_attr(self::OPTION_KEY); ?>[openai_model]" value="<?php echo esc_attr($settings['openai_model']); ?>" /></td>
                    </tr>
                </table>
                <?php submit_button('설정 저장'); ?>
            </form>

            <hr />
            <h2>수동 실행</h2>
            <p>지금 바로 최신 글 가져오기를 실행합니다.</p>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <input type="hidden" name="action" value="toss_finance_ap_manual_run" />
                <?php wp_nonce_field(self::NONCE_ACTION); ?>
                <?php submit_button('지금 실행', 'secondary'); ?>
            </form>
        </div>
        <?php
    }

    public function handle_manual_run() {
        if (!current_user_can('manage_options')) {
            wp_die('권한이 없습니다.');
        }

        check_admin_referer(self::NONCE_ACTION);
        $this->run_import_job();
        wp_safe_redirect(admin_url('options-general.php?page=toss-finance-autoposter'));
        exit;
    }

    public function run_import_job() {
        $settings = $this->get_settings();
        $candidates = $this->fetch_candidates($settings);

        if (empty($candidates)) {
            return;
        }

        $max = intval($settings['items_per_run']);
        $processed = 0;

        foreach ($candidates as $item) {
            if ($processed >= $max) {
                break;
            }

            $source_url = $item['link'] ?? '';
            if (!$source_url) {
                continue;
            }

            $title = wp_strip_all_tags($item['title'] ?? '');
            $raw_content = $item['content'] ?? '';
            $combined_text = $title . ' ' . wp_strip_all_tags($raw_content);
            if ($this->contains_blocked_keyword($combined_text)) {
                continue;
            }

            if (!$this->is_finance_related($title . ' ' . wp_strip_all_tags($raw_content), $settings['finance_keywords'])) {
                continue;
            }

            $rewritten = $this->rewrite_content($title, $raw_content, $source_url, $settings);
            $content = $this->compose_post_content($rewritten, $source_url, !empty($settings['include_source_link']));
            $existing_post_id = $this->find_imported_post_id($source_url);
            if ($existing_post_id > 0) {
                $post_id = $this->update_post($existing_post_id, $rewritten['title'], $content, $source_url, $settings);
            } else {
                $post_id = $this->create_post($rewritten['title'], $content, $source_url, $settings);
            }

            if ($post_id && !is_wp_error($post_id)) {
                $thumb_url = $this->extract_thumbnail_url($item, $raw_content, $source_url);
                if ($thumb_url) {
                    $this->set_featured_image_from_url($post_id, $thumb_url, $rewritten['title']);
                }
                update_post_meta($post_id, '_toss_finance_source_url', esc_url_raw($source_url));
                update_post_meta($post_id, '_toss_finance_source_hash', md5($source_url));
                $processed++;
            }
        }
    }

    private function fetch_candidates($settings) {
        if (!function_exists('fetch_feed')) {
            require_once ABSPATH . WPINC . '/feed.php';
        }

        $items = array();
        $feed = fetch_feed($settings['feed_url']);

        if (!is_wp_error($feed)) {
            $feed_items = $feed->get_items(0, 50);
            foreach ($feed_items as $feed_item) {
                $items[] = array(
                    'title' => $feed_item->get_title(),
                    'link' => $feed_item->get_link(),
                    'content' => $feed_item->get_content() ?: $feed_item->get_description(),
                    'enclosures' => $feed_item->get_enclosures(),
                    'media_thumbnail' => $feed_item->get_item_tags('http://search.yahoo.com/mrss/', 'thumbnail'),
                );
            }
        }

        if (!empty($items)) {
            return $items;
        }

        $response = wp_remote_get($settings['source_page_url'], array('timeout' => 20));
        if (is_wp_error($response)) {
            return array();
        }

        $html = wp_remote_retrieve_body($response);
        if (!$html) {
            return array();
        }

        if (preg_match_all('/<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)<\/a>/is', $html, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $m) {
                $url = html_entity_decode($m[1]);
                $label = trim(wp_strip_all_tags($m[2]));

                if (!$url || !$label) {
                    continue;
                }
                if (strpos($url, 'http') !== 0) {
                    $url = rtrim($settings['source_page_url'], '/') . '/' . ltrim($url, '/');
                }
                if (strpos($url, 'toss.im') === false) {
                    continue;
                }

                $items[] = array(
                    'title' => $label,
                    'link' => esc_url_raw($url),
                    'content' => '',
                    'enclosures' => array(),
                    'media_thumbnail' => array(),
                );

                if (count($items) >= 50) {
                    break;
                }
            }
        }

        return $items;
    }

    private function find_imported_post_id($source_url) {
        $existing = get_posts(array(
            'post_type' => 'post',
            'post_status' => 'any',
            'posts_per_page' => 1,
            'meta_key' => '_toss_finance_source_hash',
            'meta_value' => md5($source_url),
            'fields' => 'ids',
        ));

        if (empty($existing)) {
            return 0;
        }
        return intval($existing[0]);
    }

    private function keyword_list($csv) {
        $parts = array_map('trim', explode(',', (string) $csv));
        return array_values(array_filter($parts, function ($k) {
            return $k !== '';
        }));
    }

    private function is_finance_related($text, $keyword_csv) {
        $plain = $this->str_to_lower(wp_strip_all_tags((string) $text));
        foreach ($this->keyword_list($keyword_csv) as $keyword) {
            if ($this->str_contains($plain, $this->str_to_lower($keyword))) {
                return true;
            }
        }
        return false;
    }

    private function contains_blocked_keyword($text) {
        $plain = $this->str_to_lower(wp_strip_all_tags((string) $text));
        return $this->str_contains($plain, '토스') || $this->str_contains($plain, 'toss');
    }

    private function rewrite_content($title, $raw_html, $source_url, $settings) {
        $text = trim(preg_replace('/\s+/u', ' ', wp_strip_all_tags($raw_html)));
        if ($text === '') {
            $text = $this->fetch_article_text($source_url);
        }

        if (!empty($settings['openai_enabled']) && !empty($settings['openai_api_key'])) {
            $ai = $this->rewrite_with_openai($title, $text, $settings);
            if (!empty($ai)) {
                return $ai;
            }
        }

        return $this->rewrite_locally($title, $text);
    }

    private function fetch_article_text($url) {
        $response = wp_remote_get($url, array('timeout' => 20));
        if (is_wp_error($response)) {
            return '';
        }

        $html = wp_remote_retrieve_body($response);
        if (!$html) {
            return '';
        }

        $text = trim(preg_replace('/\s+/u', ' ', wp_strip_all_tags($html)));
        return $this->str_sub($text, 0, 4000);
    }

    private function rewrite_with_openai($title, $text, $settings) {
        $model = trim($settings['openai_model']);
        if ($model === '') {
            $model = 'gpt-4o-mini';
        }

        $prompt = "아래 금융 콘텐츠를 기반으로 한국어 블로그용 요약문을 작성하세요. 원문 문장을 그대로 복사하지 말고 재구성하세요. 결과는 JSON만 반환하세요: {\"title\":\"...\",\"intro\":\"...\",\"points\":[\"...\",\"...\"],\"closing\":\"...\"}. 말투는 자연스러운 해요체, 과장 금지, 투자 조언 단정 표현 금지.";
        $payload = array(
            'model' => $model,
            'temperature' => 0.4,
            'messages' => array(
                array(
                    'role' => 'system',
                    'content' => '당신은 금융 정보 요약 에디터입니다. 정확성 중심으로 간결하게 작성합니다.',
                ),
                array(
                    'role' => 'user',
                    'content' => $prompt . "\n\n제목: " . $title . "\n\n원문:\n" . $this->str_sub($text, 0, 6000),
                ),
            ),
            'response_format' => array('type' => 'json_object'),
        );

        $response = wp_remote_post('https://api.openai.com/v1/chat/completions', array(
            'timeout' => 60,
            'headers' => array(
                'Content-Type' => 'application/json',
                'Authorization' => 'Bearer ' . trim($settings['openai_api_key']),
            ),
            'body' => wp_json_encode($payload),
        ));

        if (is_wp_error($response)) {
            return array();
        }

        $code = wp_remote_retrieve_response_code($response);
        if ($code < 200 || $code >= 300) {
            return array();
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);
        $json_text = $body['choices'][0]['message']['content'] ?? '';
        if (!$json_text) {
            return array();
        }

        $decoded = json_decode($json_text, true);
        if (!is_array($decoded)) {
            return array();
        }

        $points = array();
        if (!empty($decoded['points']) && is_array($decoded['points'])) {
            foreach ($decoded['points'] as $point) {
                $p = trim(wp_strip_all_tags((string) $point));
                if ($p !== '') {
                    $points[] = $p;
                }
            }
        }

        return array(
            'title' => trim(wp_strip_all_tags($decoded['title'] ?? $title)),
            'intro' => trim(wp_strip_all_tags($decoded['intro'] ?? '핵심 내용을 간단히 정리해요.')),
            'points' => !empty($points) ? array_slice($points, 0, 6) : array('핵심 포인트를 정리해요.'),
            'closing' => trim(wp_strip_all_tags($decoded['closing'] ?? '세부 조건은 원문 기준으로 다시 확인해 주세요.')),
        );
    }

    private function rewrite_locally($title, $text) {
        $sentences = preg_split('/(?<=[\.\!\?다요])\s+/u', (string) $text, -1, PREG_SPLIT_NO_EMPTY);
        $sentences = array_values(array_filter(array_map('trim', $sentences), function ($s) {
            return $this->str_len($s) > 8;
        }));

        $intro = !empty($sentences[0]) ? $this->to_haeyo($sentences[0]) : '이번 글의 금융 핵심 내용을 간단히 정리해요.';
        $points = array();

        for ($i = 1; $i < min(7, count($sentences)); $i++) {
            $points[] = $this->to_haeyo($sentences[$i]);
        }

        if (empty($points)) {
            $points = array(
                '핵심 조건과 수수료, 금리 같은 수치 항목을 먼저 확인해요.',
                '내 상황에 맞는 장단점을 구분해서 비교해요.',
                '적용 시점과 변경 가능성은 원문 기준으로 다시 확인해요.',
            );
        }

        return array(
            'title' => $title,
            'intro' => $intro,
            'points' => $points,
            'closing' => '의사결정 전에 최신 조건과 유의사항을 한 번 더 체크해 주세요.',
        );
    }

    private function to_haeyo($sentence) {
        $s = trim((string) $sentence);
        if ($s === '') {
            return $s;
        }

        $replacements = array(
            '입니다.' => '이에요.',
            '입니다' => '이에요',
            '합니다.' => '해요.',
            '합니다' => '해요',
            '됩니다.' => '돼요.',
            '됩니다' => '돼요',
            '있습니다.' => '있어요.',
            '있습니다' => '있어요',
            '없습니다.' => '없어요.',
            '없습니다' => '없어요',
        );

        $s = str_replace(array_keys($replacements), array_values($replacements), $s);
        if (!preg_match('/[.!?]$/u', $s)) {
            $s .= '.';
        }
        return $s;
    }

    private function compose_post_content($rewritten, $source_url, $include_source_link) {
        $parts = array();
        $parts[] = '<h2>핵심 요약</h2>';
        $parts[] = '<p>' . esc_html($rewritten['intro']) . '</p>';

        $parts[] = '<h3>주요 포인트</h3>';
        $parts[] = '<ul>';
        foreach ($rewritten['points'] as $point) {
            $parts[] = '<li>' . esc_html($point) . '</li>';
        }
        $parts[] = '</ul>';

        $parts[] = '<h4>체크 포인트</h4>';
        $parts[] = '<ul>';
        $parts[] = '<li>조건 변경 가능성이 있는 항목은 최신 공지 기준으로 다시 확인해요.</li>';
        $parts[] = '<li>수수료, 금리, 한도처럼 수치가 중요한 항목은 직접 비교해요.</li>';
        $parts[] = '<li>내 사용 패턴에 맞는지 먼저 따져보고 선택해요.</li>';
        $parts[] = '</ul>';

        $parts[] = '<h4>한 줄 정리</h4>';
        $parts[] = '<p>' . esc_html($rewritten['closing']) . '</p>';

        if ($include_source_link) {
            $parts[] = '<hr />';
            $parts[] = '<p><strong>출처:</strong> <a href="' . esc_url($source_url) . '" target="_blank" rel="noopener noreferrer">원문 보기</a></p>';
        }

        return implode("\n", $parts);
    }

    private function create_post($title, $content, $source_url, $settings) {
        $prefix = trim($settings['title_prefix']);
        $fixed_title = '금융정보';
        $post_title = $prefix ? $prefix . ' ' . $fixed_title : $fixed_title;

        $post_data = array(
            'post_type' => 'post',
            'post_status' => $settings['post_status'],
            'post_title' => $post_title,
            'post_content' => $content,
            'post_author' => intval($settings['post_author']),
        );

        $post_id = wp_insert_post($post_data, true);
        if (is_wp_error($post_id)) {
            return $post_id;
        }

        if (intval($settings['target_category']) > 0) {
            wp_set_post_categories($post_id, array(intval($settings['target_category'])));
        } else {
            $finance_cat_id = $this->ensure_finance_category();
            if ($finance_cat_id > 0) {
                wp_set_post_categories($post_id, array($finance_cat_id));
            }
        }

        update_post_meta($post_id, '_toss_finance_source_url', esc_url_raw($source_url));
        update_post_meta($post_id, '_toss_finance_source_hash', md5($source_url));

        return $post_id;
    }

    private function update_post($post_id, $title, $content, $source_url, $settings) {
        $prefix = trim($settings['title_prefix']);
        $fixed_title = '금융정보';
        $post_title = $prefix ? $prefix . ' ' . $fixed_title : $fixed_title;

        $current_status = get_post_status($post_id);
        if (!$current_status) {
            $current_status = $settings['post_status'];
        }

        $post_data = array(
            'ID' => intval($post_id),
            'post_status' => $current_status,
            'post_title' => $post_title,
            'post_content' => $content,
            'post_author' => intval($settings['post_author']),
        );

        $updated_id = wp_update_post($post_data, true);
        if (is_wp_error($updated_id)) {
            return $updated_id;
        }

        if (intval($settings['target_category']) > 0) {
            wp_set_post_categories($updated_id, array(intval($settings['target_category'])));
        } else {
            $finance_cat_id = $this->ensure_finance_category();
            if ($finance_cat_id > 0) {
                wp_set_post_categories($updated_id, array($finance_cat_id));
            }
        }

        update_post_meta($updated_id, '_toss_finance_source_url', esc_url_raw($source_url));
        update_post_meta($updated_id, '_toss_finance_source_hash', md5($source_url));

        return $updated_id;
    }

    private function extract_thumbnail_url($item, $raw_content, $source_url) {
        $enclosures = $item['enclosures'] ?? array();
        if (!empty($enclosures) && is_array($enclosures)) {
            foreach ($enclosures as $enclosure) {
                if (is_object($enclosure) && method_exists($enclosure, 'get_link')) {
                    $link = $enclosure->get_link();
                    if ($this->is_image_url($link)) {
                        return esc_url_raw($link);
                    }
                }
            }
        }

        $thumb = $item['media_thumbnail'] ?? array();
        if (!empty($thumb[0]['attribs']['']['url'])) {
            $candidate = $thumb[0]['attribs']['']['url'];
            if ($this->is_image_url($candidate)) {
                return esc_url_raw($candidate);
            }
        }

        if (preg_match('/<img[^>]+src=["\\\']([^"\\\']+)["\\\']/i', (string) $raw_content, $m)) {
            $candidate = $m[1];
            if ($this->is_image_url($candidate)) {
                return esc_url_raw($candidate);
            }
        }

        $article_html = $this->fetch_article_html($source_url);
        if ($article_html && preg_match('/<img[^>]+src=["\\\']([^"\\\']+)["\\\']/i', $article_html, $m2)) {
            $candidate = $m2[1];
            if (strpos($candidate, 'http') !== 0) {
                $candidate = $this->to_absolute_url($source_url, $candidate);
            }
            if ($this->is_image_url($candidate)) {
                return esc_url_raw($candidate);
            }
        }

        return '';
    }

    private function is_image_url($url) {
        if (empty($url) || !is_string($url)) {
            return false;
        }
        return (bool) preg_match('/\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i', $url);
    }

    private function set_featured_image_from_url($post_id, $image_url, $title = '') {
        if (has_post_thumbnail($post_id)) {
            return;
        }

        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        $tmp = download_url($image_url, 20);
        if (is_wp_error($tmp)) {
            return;
        }

        $path = parse_url($image_url, PHP_URL_PATH);
        if (!is_string($path)) {
            $path = '';
        }
        $filename = wp_basename($path);
        if (!$filename) {
            $filename = 'toss-finance-thumb.jpg';
        }

        $file_array = array(
            'name' => sanitize_file_name($filename),
            'tmp_name' => $tmp,
        );

        $attachment_id = media_handle_sideload($file_array, $post_id, $title);
        if (is_wp_error($attachment_id)) {
            @unlink($tmp);
            return;
        }

        set_post_thumbnail($post_id, $attachment_id);
    }

    private function fetch_article_html($url) {
        $response = wp_remote_get($url, array('timeout' => 20));
        if (is_wp_error($response)) {
            return '';
        }

        $html = wp_remote_retrieve_body($response);
        return is_string($html) ? $html : '';
    }

    private function str_to_lower($text) {
        if (function_exists('mb_strtolower')) {
            return mb_strtolower((string) $text, 'UTF-8');
        }
        return strtolower((string) $text);
    }

    private function str_contains($haystack, $needle) {
        return strpos((string) $haystack, (string) $needle) !== false;
    }

    private function str_sub($text, $start, $length) {
        if (function_exists('mb_substr')) {
            return mb_substr((string) $text, intval($start), intval($length), 'UTF-8');
        }
        return substr((string) $text, intval($start), intval($length));
    }

    private function str_len($text) {
        if (function_exists('mb_strlen')) {
            return mb_strlen((string) $text, 'UTF-8');
        }
        return strlen((string) $text);
    }

    private function to_absolute_url($base_url, $path_or_url) {
        $candidate = trim((string) $path_or_url);
        if ($candidate === '') {
            return '';
        }
        if (strpos($candidate, 'http://') === 0 || strpos($candidate, 'https://') === 0) {
            return $candidate;
        }
        if (strpos($candidate, '//') === 0) {
            return 'https:' . $candidate;
        }

        $parts = wp_parse_url($base_url);
        if (!is_array($parts) || empty($parts['host'])) {
            return $candidate;
        }

        $scheme = !empty($parts['scheme']) ? $parts['scheme'] : 'https';
        $host = $parts['host'];

        if (strpos($candidate, '/') === 0) {
            return $scheme . '://' . $host . $candidate;
        }

        $base_path = !empty($parts['path']) ? $parts['path'] : '/';
        $base_dir = trailingslashit(dirname($base_path));
        return $scheme . '://' . $host . $base_dir . ltrim($candidate, '/');
    }
}

new Toss_Finance_Autoposter();
