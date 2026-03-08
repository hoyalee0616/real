<?php
/**
 * Plugin Name: YellowIT IT Review Auto Poster
 * Description: Import posts from YellowIT IT Review feed, simplify tone to Korean haeyo style, and auto-post daily.
 * Version: 0.1.0
 * Author: Codex
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

class Yellowit_IT_Review_Autoposter {
    const OPTION_KEY = 'yellowit_ir_settings';
    const CRON_HOOK = 'yellowit_ir_run_import';
    const NONCE_ACTION = 'yellowit_ir_manual_run';

    public function __construct() {
        add_action('admin_menu', array($this, 'register_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action(self::CRON_HOOK, array($this, 'run_import_job'));
        add_action('admin_post_yellowit_ir_manual_run', array($this, 'handle_manual_run'));

        register_activation_hook(__FILE__, array($this, 'on_activate'));
        register_deactivation_hook(__FILE__, array($this, 'on_deactivate'));
    }

    public function on_activate() {
        $it_info_cat_id = $this->ensure_it_info_category();
        if ($it_info_cat_id > 0) {
            $settings = $this->get_settings();
            if (intval($settings['target_category']) === 0) {
                $settings['target_category'] = $it_info_cat_id;
                update_option(self::OPTION_KEY, $settings);
            }
        }

        if (!wp_next_scheduled(self::CRON_HOOK)) {
            wp_schedule_event(time() + 120, 'daily', self::CRON_HOOK);
        }
    }

    public function on_deactivate() {
        wp_clear_scheduled_hook(self::CRON_HOOK);
    }

    public function default_settings() {
        return array(
            'feed_url' => 'https://yellowit.co.kr/category/it-review/feed/',
            'post_status' => 'draft',
            'post_author' => 1,
            'target_category' => 0,
            'items_per_run' => 3,
            'title_prefix' => '[IT리뷰정리]',
            'include_source_link' => 0
        );
    }

    public function get_settings() {
        $saved = get_option(self::OPTION_KEY, array());
        return wp_parse_args($saved, $this->default_settings());
    }

    public function register_admin_menu() {
        add_options_page(
            'YellowIT Auto Poster',
            'YellowIT Auto Poster',
            'manage_options',
            'yellowit-itreview-autoposter',
            array($this, 'render_settings_page')
        );
    }

    public function register_settings() {
        register_setting(
            'yellowit_ir_settings_group',
            self::OPTION_KEY,
            array($this, 'sanitize_settings')
        );
    }

    public function sanitize_settings($input) {
        $defaults = $this->default_settings();

        return array(
            'feed_url' => esc_url_raw(isset($input['feed_url']) ? $input['feed_url'] : $defaults['feed_url']),
            'post_status' => in_array($input['post_status'] ?? 'draft', array('draft', 'publish'), true) ? $input['post_status'] : 'draft',
            'post_author' => max(1, intval($input['post_author'] ?? 1)),
            'target_category' => max(0, intval($input['target_category'] ?? 0)),
            'items_per_run' => min(10, max(1, intval($input['items_per_run'] ?? 3))),
            'title_prefix' => sanitize_text_field($input['title_prefix'] ?? '[리뷰요약]'),
            'include_source_link' => 0
        );
    }

    private function ensure_it_info_category() {
        $term = get_term_by('name', 'IT 정보', 'category');
        if ($term && !is_wp_error($term)) {
            return intval($term->term_id);
        }

        $created = wp_insert_term('IT 정보', 'category', array(
            'slug' => 'it-info'
        ));

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
            <h1>YellowIT IT Review Auto Poster</h1>
            <p>IT Review 카테고리 피드를 가져와서 해요체 요약본으로 자동 포스팅해요.</p>

            <form method="post" action="options.php">
                <?php settings_fields('yellowit_ir_settings_group'); ?>
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row"><label for="feed_url">피드 URL</label></th>
                        <td>
                            <input type="url" class="regular-text" id="feed_url" name="<?php echo esc_attr(self::OPTION_KEY); ?>[feed_url]" value="<?php echo esc_attr($settings['feed_url']); ?>" />
                        </td>
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
                                <option value="0">사용 안 함</option>
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
                        <td>
                            <input type="number" min="1" max="10" id="items_per_run" name="<?php echo esc_attr(self::OPTION_KEY); ?>[items_per_run]" value="<?php echo esc_attr($settings['items_per_run']); ?>" />
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="title_prefix">제목 접두사</label></th>
                        <td>
                            <input type="text" id="title_prefix" name="<?php echo esc_attr(self::OPTION_KEY); ?>[title_prefix]" value="<?php echo esc_attr($settings['title_prefix']); ?>" />
                        </td>
                    </tr>
                </table>
                <?php submit_button('설정 저장'); ?>
            </form>

            <hr />
            <h2>수동 실행</h2>
            <p>지금 바로 가져오기를 실행해요.</p>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <input type="hidden" name="action" value="yellowit_ir_manual_run" />
                <?php wp_nonce_field(self::NONCE_ACTION); ?>
                <?php submit_button('지금 실행', 'secondary'); ?>
            </form>
        </div>
        <?php
    }

    public function handle_manual_run() {
        if (!current_user_can('manage_options')) {
            wp_die('권한이 없어요.');
        }

        check_admin_referer(self::NONCE_ACTION);
        $this->run_import_job();
        wp_safe_redirect(admin_url('options-general.php?page=yellowit-itreview-autoposter'));
        exit;
    }

    public function run_import_job() {
        if (!function_exists('fetch_feed')) {
            require_once ABSPATH . WPINC . '/feed.php';
        }

        $settings = $this->get_settings();
        $feed = fetch_feed($settings['feed_url']);
        if (is_wp_error($feed)) {
            return;
        }

        $max = intval($settings['items_per_run']);
        $items = $feed->get_items(0, $max);
        if (empty($items)) {
            return;
        }

        foreach ($items as $item) {
            $guid = $item->get_id();
            if ($this->already_imported($guid)) {
                continue;
            }

            $title = wp_strip_all_tags($item->get_title());
            $raw_content = $item->get_content();
            if (empty($raw_content)) {
                $raw_content = $item->get_description();
            }

            $summary = $this->build_haeyo_summary($raw_content);
            $content = $this->compose_post_content($summary);
            $post_id = $this->create_post($title, $content, $guid, $item->get_link(), $settings);

            if ($post_id && !is_wp_error($post_id)) {
                $thumb_url = $this->extract_thumbnail_url($item, $raw_content);
                if ($thumb_url) {
                    $this->set_featured_image_from_url($post_id, $thumb_url, $title);
                }
                update_post_meta($post_id, '_yellowit_source_guid', sanitize_text_field($guid));
                update_post_meta($post_id, '_yellowit_source_url', esc_url_raw($item->get_link()));
            }
        }
    }

    private function extract_thumbnail_url($item, $raw_content) {
        $enclosures = $item->get_enclosures();
        if (!empty($enclosures) && is_array($enclosures)) {
            foreach ($enclosures as $enclosure) {
                $link = $enclosure->get_link();
                if ($this->is_image_url($link)) {
                    return esc_url_raw($link);
                }
            }
        }

        $thumb = $item->get_item_tags('http://search.yahoo.com/mrss/', 'thumbnail');
        if (!empty($thumb[0]['attribs']['']['url'])) {
            $candidate = $thumb[0]['attribs']['']['url'];
            if ($this->is_image_url($candidate)) {
                return esc_url_raw($candidate);
            }
        }

        if (preg_match('/<img[^>]+src=["\\\']([^"\\\']+)["\\\']/i', $raw_content, $m)) {
            $candidate = $m[1];
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

        $filename = wp_basename(parse_url($image_url, PHP_URL_PATH));
        if (!$filename) {
            $filename = 'yellowit-thumb.jpg';
        }

        $file_array = array(
            'name' => sanitize_file_name($filename),
            'tmp_name' => $tmp
        );

        $attachment_id = media_handle_sideload($file_array, $post_id, $title);
        if (is_wp_error($attachment_id)) {
            @unlink($tmp);
            return;
        }

        set_post_thumbnail($post_id, $attachment_id);
    }

    private function already_imported($guid) {
        $existing = get_posts(array(
            'post_type' => 'post',
            'post_status' => 'any',
            'posts_per_page' => 1,
            'meta_key' => '_yellowit_source_guid',
            'meta_value' => sanitize_text_field($guid),
            'fields' => 'ids'
        ));
        return !empty($existing);
    }

    private function compose_post_content($summary) {
        $parts = array();
        $parts[] = '<h1>' . esc_html($summary['h1']) . '</h1>';
        $parts[] = '<p>' . esc_html($summary['intro']) . '</p>';

        if (!empty($summary['context'])) {
            $parts[] = '<h2>배경과 맥락</h2>';
            foreach ($summary['context'] as $paragraph) {
                $parts[] = '<p>' . esc_html($paragraph) . '</p>';
            }
        }

        if (!empty($summary['details'])) {
            $parts[] = '<h2>핵심 내용 정리</h2>';
            foreach ($summary['details'] as $paragraph) {
                $parts[] = '<p>' . esc_html($paragraph) . '</p>';
            }
        }

        if (!empty($summary['checklist'])) {
            $parts[] = '<h3>실무 체크포인트</h3><ul>';
            foreach ($summary['checklist'] as $point) {
                $parts[] = '<li>' . esc_html($point) . '</li>';
            }
            $parts[] = '</ul>';
        }

        if (!empty($summary['closing'])) {
            $parts[] = '<h3>정리</h3>';
            $parts[] = '<p>' . esc_html($summary['closing']) . '</p>';
        }

        return implode("\n", $parts);
    }

    private function create_post($title, $content, $guid, $source_url, $settings) {
        $prefix = trim($settings['title_prefix']);
        $post_title = $prefix ? $prefix . ' ' . $title : $title;

        $post_data = array(
            'post_type' => 'post',
            'post_status' => $settings['post_status'],
            'post_title' => $post_title,
            'post_content' => $content,
            'post_author' => intval($settings['post_author'])
        );

        $post_id = wp_insert_post($post_data, true);
        if (is_wp_error($post_id)) {
            return $post_id;
        }

        if (intval($settings['target_category']) > 0) {
            wp_set_post_categories($post_id, array(intval($settings['target_category'])));
        } else {
            $it_info_cat_id = $this->ensure_it_info_category();
            if ($it_info_cat_id > 0) {
                wp_set_post_categories($post_id, array($it_info_cat_id));
            }
        }

        update_post_meta($post_id, '_yellowit_source_guid', sanitize_text_field($guid));
        update_post_meta($post_id, '_yellowit_source_url', esc_url_raw($source_url));
        return $post_id;
    }

    private function build_haeyo_summary($html) {
        $text = wp_strip_all_tags($html);
        $text = preg_replace('/\s+/', ' ', $text);
        $text = trim($text);

        if ($text === '') {
            return array(
                'h1' => 'IT 리뷰 요약',
                'intro' => '원문을 불러왔는데 요약할 본문이 없어요.',
                'context' => array(),
                'details' => array(),
                'checklist' => array(),
                'closing' => '원문 링크에서 내용을 직접 확인해 주세요.'
            );
        }

        $sentences = preg_split('/(?<=[\.\!\?다요])\s+/u', $text, -1, PREG_SPLIT_NO_EMPTY);
        $sentences = array_values(array_filter(array_map('trim', $sentences), function($s) {
            return mb_strlen($s) > 6;
        }));
        $sentences = array_slice($sentences, 0, 24);

        $intro = isset($sentences[0]) ? $this->to_haeyo($sentences[0]) : '이번 글의 핵심 내용을 간단히 정리해요.';
        $context = array();
        $details = array();
        $checklist = array();

        $contextMax = min(4, max(1, intval(count($sentences) / 5)));
        for ($i = 1; $i <= $contextMax && $i < count($sentences); $i++) {
            $context[] = $this->to_haeyo($sentences[$i]);
        }

        for ($i = $contextMax + 1; $i < count($sentences); $i++) {
            $details[] = $this->to_haeyo($sentences[$i]);
        }

        if (empty($details)) {
            $details[] = '핵심 항목을 차근차근 읽어보면 실제 활용 포인트가 더 분명해져요.';
            $details[] = '조건과 장단점을 같이 비교하면 어떤 상황에 맞는 선택인지 판단하기 쉬워져요.';
        }

        $checklist[] = '본문에서 언급된 핵심 수치와 조건을 먼저 표로 정리해 두면 비교가 쉬워요.';
        $checklist[] = '기능이나 정책 변경 시점이 있다면 실제 적용 시점을 꼭 다시 확인해요.';
        $checklist[] = '본인 상황에 맞는 우선순위를 정하고 항목별로 점수를 매겨보면 선택이 빨라져요.';

        $closingSource = isset($details[count($details) - 1]) ? $details[count($details) - 1] : '';
        if ($closingSource) {
            $closing = $this->to_haeyo('결론적으로 ' . preg_replace('/[.!?]$/u', '', $closingSource) . ' 내용을 기준으로 판단하면 좋아요');
        } else {
            $closing = '핵심 포인트를 기준으로 우선순위를 세우면 선택이 훨씬 쉬워져요.';
        }
        return array(
            'h1' => 'IT 리뷰 상세 정리',
            'intro' => $intro,
            'context' => $context,
            'details' => $details,
            'checklist' => $checklist,
            'closing' => $closing
        );
    }

    private function to_haeyo($sentence) {
        $s = trim($sentence);
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
            '보입니다.' => '보여요.',
            '보입니다' => '보여요'
        );
        $s = str_replace(array_keys($replacements), array_values($replacements), $s);

        if (!preg_match('/[.!?]$/u', $s)) {
            $s .= '.';
        }
        return $s;
    }
}

new Yellowit_IT_Review_Autoposter();
