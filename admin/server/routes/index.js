var _ = require('lodash');
var ejs = require('ejs');
var path = require('path');

var templatePath = path.resolve(__dirname, '../templates/index.html');

const acl = {
	admin: {
		shared: [
			'Asset',
			'Endorsement',
			'Hero',
			'Post',
			'PostCategory'
		],
		homepage: [
			'Benefit',
			'DesOverview'
		],
		about: [
			'AboutSection',
			'AboutPrinciple',
			'AboutFeature',
			'AboutProcessItem',
			'Skill'
		],
		dashboards: [
			'DashboardsPage',
		    'Dashboard',
	    ],
		products: [
			'Product'
		],
		contact: [
			'ContactForm',
			'ContactFormResponse'
		],
		users: [
			'User',
			'UserRole'
		]
	},
	contributor: {
		shared: [
			'Asset',
			'Endorsement',
			'Hero',
			'Post',
		],
		dashboards: [
		    'Dashboard',
	    ],
		products: [
			'Product'
		]
	}
};

/**
 * Evaluate if section is accessible
 * Section is accessible by default if there is no ACL entry for user.role.key
 *
 * @param {string} key
 *
 * @return {boolean}
 */
function isSectionAccessible (key, access) {
	return access && access.includes(key);
}

/**
 * Filter out sections that should not be visible to a given user
 *
 * @param {Object[]} sections
 * @param {string[]} access
 *
 * @return {*}
 */
function restrictNav (sections, access) {
	if (Array.isArray(sections)) {
		return sections
			.filter(section => isSectionAccessible(section.key, access));
	}

	return sections;
}

module.exports = function IndexRoute (req, res) {
	var keystone = req.keystone;
	const user = req.user;
	var lists = {};
	const accessibleSections = _.flatten(_.values(acl[user.role.key]));
	_.forEach(keystone.lists, function (list, key) {
		lists[key] = list.getOptions();

		if (!isSectionAccessible(list.key, accessibleSections)) {
			lists[key].nocreate = true;
			lists[key].noedit = true;
			lists[key].nodelete = true;
		}
	});

	var UserList = keystone.list(keystone.get('user model'));

	var orphanedLists = keystone.getOrphanedLists().map(function (list) {
		return _.pick(list, ['key', 'label', 'path']);
	});

	var backUrl = keystone.get('back url');
	if (backUrl === undefined) {
		// backUrl can be falsy, to disable the link altogether
		// but if it's undefined, default it to "/"
		backUrl = '/';
	}

	/* Restricting NAV */
	keystone.roleNav = keystone.roleNav || {
		default: _.cloneDeep(keystone.nav),
	};

	keystone.roleNav = keystone.roleNav || {
		default: _.cloneDeep(keystone.nav),
	};

	if (user && user.role && !keystone.roleNav[user.role.key]) {
		console.log(`Restricting nav for ${user.role.key}`);

		const access = acl[user.role.key];
		const menu = _.cloneDeep(keystone.roleNav.default);

		menu.sections = menu.sections
			.map(function (section) {
				section.lists = restrictNav(section.lists, access[section.key]);

				return section;
			})
			.filter(section => section.lists.length);

		keystone.roleNav[user.role.key] = menu;
	}

	keystone.nav = keystone.roleNav[user.role.key];
	/* Restricting NAV */

	var keystoneData = {
		adminPath: '/' + keystone.get('admin path'),
		appversion: keystone.get('appversion'),
		backUrl: backUrl,
		brand: keystone.get('brand'),
		csrf: { header: {} },
		devMode: !!process.env.KEYSTONE_DEV,
		lists: lists,
		nav: keystone.nav,
		orphanedLists: orphanedLists,
		signoutUrl: keystone.get('signout url'),
		user: {
			id: req.user.id,
			name: UserList.getDocumentName(req.user) || '(no name)',
			role: req.user.role,
		},
		userList: UserList.key,
		version: keystone.version,
		wysiwyg: { options: {
			enableImages: keystone.get('wysiwyg images') ? true : false,
			enableCloudinaryUploads: keystone.get('wysiwyg cloudinary images') ? true : false,
			enableS3Uploads: keystone.get('wysiwyg s3 images') ? true : false,
			additionalButtons: keystone.get('wysiwyg additional buttons') || '',
			additionalPlugins: keystone.get('wysiwyg additional plugins') || '',
			additionalOptions: keystone.get('wysiwyg additional options') || {},
			overrideToolbar: keystone.get('wysiwyg override toolbar'),
			skin: keystone.get('wysiwyg skin') || 'keystone',
			menubar: keystone.get('wysiwyg menubar'),
			importcss: keystone.get('wysiwyg importcss') || '',
		} },
	};
	keystoneData.csrf.header[keystone.security.csrf.CSRF_HEADER_KEY] = keystone.security.csrf.getToken(req, res);

	var codemirrorPath = keystone.get('codemirror url path')
		? '/' + keystone.get('codemirror url path')
		: '/' + keystone.get('admin path') + '/js/lib/codemirror';

	var locals = {
		adminPath: keystoneData.adminPath,
		cloudinaryScript: false,
		codemirrorPath: codemirrorPath,
		env: keystone.get('env'),
		fieldTypes: keystone.fieldTypes,
		ga: {
			property: keystone.get('ga property'),
			domain: keystone.get('ga domain'),
		},
		keystone: keystoneData,
		title: keystone.get('name') || 'Keystone',
	};

	var cloudinaryConfig = keystone.get('cloudinary config');
	if (cloudinaryConfig) {
		var cloudinary = require('cloudinary');
		var cloudinaryUpload = cloudinary.uploader.direct_upload();
		keystoneData.cloudinary = {
			cloud_name: keystone.get('cloudinary config').cloud_name,
			api_key: keystone.get('cloudinary config').api_key,
			timestamp: cloudinaryUpload.hidden_fields.timestamp,
			signature: cloudinaryUpload.hidden_fields.signature,
		};
		locals.cloudinaryScript = cloudinary.cloudinary_js_config();
	};

	ejs.renderFile(templatePath, locals, {}, function (err, str) {
		if (err) {
			console.error('Could not render Admin UI Index Template:', err);
			return res.status(500).send(keystone.wrapHTMLError('Error Rendering Admin UI', err.message));
		}
		res.send(str);
	});
};
